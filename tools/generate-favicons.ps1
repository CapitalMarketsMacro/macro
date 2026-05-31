<#
  generate-favicons.ps1

  Rasterizes the brand mark (MacroThemeCondensed/assets/favicon.svg) into a
  multi-resolution favicon.ico and copies the source SVG into each app's
  public/ folder, so every app shares one brand favicon.

  Windows taskbar / .lnk shortcuts cannot use an SVG, so we generate a proper
  .ico (PNG-compressed frames, supported by Windows Vista+ and Chromium/OpenFin).

  Dependency-free: uses .NET System.Drawing. The source SVG is rect-only, which
  we parse directly so the .ico tracks edits to the SVG geometry/colors.

  Usage:  pwsh -File tools/generate-favicons.ps1
#>

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$svgPath  = Join-Path $repoRoot 'apps/macro-workspace/public/MacroThemeCondensed/assets/favicon.svg'

# App public/ folders that should carry the brand favicon.
$targets = @(
  'apps/macro-workspace/public',
  'apps/macro-angular/public',
  'apps/macro-angular-fdc3/public',
  'apps/macro-react/public',
  'apps/capital-markets-themes/public'
) | ForEach-Object { Join-Path $repoRoot $_ }

$sizes = @(16, 24, 32, 48, 64, 128, 256)

# ── Parse the rect-only SVG ───────────────────────────────────────────────
$svg = Get-Content -Raw -Path $svgPath

$viewBox = [regex]::Match($svg, 'viewBox="\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*"')
if (-not $viewBox.Success) { throw "No viewBox found in $svgPath" }
$vbW = [double]$viewBox.Groups[3].Value
$vbH = [double]$viewBox.Groups[4].Value

function Get-Attr([string]$tag, [string]$name, [double]$default) {
  $m = [regex]::Match($tag, "$name=`"([\d.]+)`"")
  if ($m.Success) { return [double]$m.Groups[1].Value } else { return $default }
}

$rects = @()
foreach ($m in [regex]::Matches($svg, '<rect[^>]*?/?>')) {
  $tag = $m.Value
  $fill = [regex]::Match($tag, 'fill="(#[0-9a-fA-F]{3,8})"')
  if (-not $fill.Success) { continue }
  $hex = $fill.Groups[1].Value.TrimStart('#')
  if ($hex.Length -eq 3) { $hex = ($hex.ToCharArray() | ForEach-Object { "$_$_" }) -join '' }
  $rects += [pscustomobject]@{
    X = Get-Attr $tag 'x' 0; Y = Get-Attr $tag 'y' 0
    W = Get-Attr $tag 'width' 0; H = Get-Attr $tag 'height' 0
    R = Get-Attr $tag 'rx' 0
    Color = [System.Drawing.Color]::FromArgb(255,
      [Convert]::ToInt32($hex.Substring(0,2),16),
      [Convert]::ToInt32($hex.Substring(2,2),16),
      [Convert]::ToInt32($hex.Substring(4,2),16))
  }
}
Write-Host "Parsed $($rects.Count) rects from favicon.svg (viewBox ${vbW}x${vbH})"

# ── Rounded-rectangle path helper ─────────────────────────────────────────
function New-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = [Math]::Min($r, [Math]::Min($w, $h) / 2)
  if ($r -le 0.01) { $path.AddRectangle((New-Object System.Drawing.RectangleF($x, $y, $w, $h))); return $path }
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

# ── Render one PNG frame at a given size → byte[] ─────────────────────────
function Render-Png([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $sx = $size / $vbW; $sy = $size / $vbH
  foreach ($r in $rects) {
    $path = New-RoundedPath ([single]($r.X * $sx)) ([single]($r.Y * $sy)) ([single]($r.W * $sx)) ([single]($r.H * $sy)) ([single]($r.R * $sx))
    $brush = New-Object System.Drawing.SolidBrush($r.Color)
    $g.FillPath($brush, $path)
    $brush.Dispose(); $path.Dispose()
  }
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return $ms.ToArray()
}

# ── Assemble a PNG-compressed .ico from the frames → byte[] ───────────────
$frames = @{}
foreach ($s in $sizes) { $frames[$s] = Render-Png $s }

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0)               # reserved
$bw.Write([uint16]1)               # type = icon
$bw.Write([uint16]$sizes.Count)    # frame count
$offset = 6 + (16 * $sizes.Count)  # data starts after the directory
foreach ($s in $sizes) {
  $png = $frames[$s]
  $dim = if ($s -ge 256) { 0 } else { $s }   # 0 means 256 in the .ico spec
  $bw.Write([byte]$dim)            # width
  $bw.Write([byte]$dim)            # height
  $bw.Write([byte]0)               # palette count
  $bw.Write([byte]0)               # reserved
  $bw.Write([uint16]1)             # color planes
  $bw.Write([uint16]32)            # bits per pixel
  $bw.Write([uint32]$png.Length)   # size of frame data
  $bw.Write([uint32]$offset)       # offset of frame data
  $offset += $png.Length
}
foreach ($s in $sizes) { $b = [byte[]]$frames[$s]; $bw.Write($b, 0, $b.Length) }
$bw.Flush()
$icoBytes = $ms.ToArray()
$bw.Dispose(); $ms.Dispose()

# ── Write favicon.ico + copy favicon.svg into every target ────────────────
foreach ($dir in $targets) {
  if (-not (Test-Path $dir)) { Write-Warning "skip (missing): $dir"; continue }
  [System.IO.File]::WriteAllBytes((Join-Path $dir 'favicon.ico'), $icoBytes)
  Copy-Item -Path $svgPath -Destination (Join-Path $dir 'favicon.svg') -Force
  Write-Host ("  wrote favicon.ico ({0:N0} bytes) + favicon.svg -> {1}" -f $icoBytes.Length, (Resolve-Path $dir).Path)
}

Write-Host "Done."

# Bypass `protobuf-src` build using local `protoc` on Windows

**Context:** `perspective-server` pulls in `protobuf-src v2.1.1+27.1` as a build dependency,
which compiles protobuf 27.1 from C source on every clean build. This guide patches it out
with a stub crate that returns your locally installed `protoc` binary instead.

**Prerequisites:**
- `protoc` installed via `winget install Google.Protobuf`
- Rust toolchain installed and working
- Your project at `C:\Users\mrudang\TurboRust` (adjust paths as needed)

---

## Step 1 — Find where winget installed protoc

Open PowerShell and run:

```powershell
where.exe protoc
protoc --version
```

Note the full path to `protoc.exe`. Winget typically installs it to:

```
C:\Users\mrudang\AppData\Local\Microsoft\WinGet\Packages\Google.Protobuf_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\protoc.exe
```

The `include\` directory will be a sibling of `bin\` in that same package folder:

```
C:\Users\<you>\AppData\Local\Microsoft\WinGet\Packages\Google.Protobuf_Microsoft.Winget.Source_8wekyb3d8bbwe\
├── bin\
│   └── protoc.exe          <-- protoc() returns this
└── include\
    └── google\
        └── protobuf\...    <-- include() returns this
```

> **Note:** If `where.exe protoc` returns a path under `WinGet\Links\`, that is a shim.
> The real binary and `include\` directory are in the `Packages\Google.Protobuf_*\` folder above.

---

## Step 2 — Create the stub crate directory

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\protobuf-src-stub\src" -Force
```

---

## Step 3 — Create `src\lib.rs`

Create the file `%USERPROFILE%\protobuf-src-stub\src\lib.rs` with the following content.
Replace the hardcoded paths with the actual paths you found in Step 1.

```rust
use std::path::PathBuf;

pub fn protoc() -> PathBuf {
    // Replace with your actual protoc.exe path from Step 1
    let path = PathBuf::from(
        r"C:\Users\mrudang\AppData\Local\Microsoft\WinGet\Packages\Google.Protobuf_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\protoc.exe"
    );
    assert!(
        path.exists(),
        "protoc.exe not found at {:?} — update the path in protobuf-src-stub",
        path
    );
    path
}

pub fn include() -> PathBuf {
    // The include\ directory sibling to bin\
    PathBuf::from(
        r"C:\Users\mrudang\AppData\Local\Microsoft\WinGet\Packages\Google.Protobuf_Microsoft.Winget.Source_8wekyb3d8bbwe\include"
    )
}
```

> The `r"..."` raw string prefix allows single backslashes — no escaping needed.

---

## Step 4 — Create `Cargo.toml` for the stub

Create the file `%USERPROFILE%\protobuf-src-stub\Cargo.toml`:

```toml
[package]
name = "protobuf-src"
version = "2.1.1+27.1"
edition = "2021"

[lib]
```

> The version string **must exactly match** what `cargo tree -i protobuf-src` reported:
> `2.1.1+27.1`. Cargo will reject a patch with a mismatched version.

Your stub directory should now look like:

```
%USERPROFILE%\protobuf-src-stub\
├── Cargo.toml
└── src\
    └── lib.rs
```

---

## Step 5 — Patch your workspace `Cargo.toml`

Open `TurboRust\Cargo.toml` and add the following section at the bottom.
Use forward slashes — Cargo handles them correctly on Windows.

```toml
[patch.crates-io]
protobuf-src = { path = "C:/Users/mrudang/protobuf-src-stub" }
```

> Run `echo $env:USERPROFILE` in PowerShell if you need to confirm your exact username.

---

## Step 6 — Verify the patch is wired up

Run this from your project directory before doing a full build:

```powershell
cargo tree -i protobuf-src
```

Expected output — the path should point to your stub, not crates.io:

```
protobuf-src v2.1.1+27.1 (C:\Users\mrudang\protobuf-src-stub)
[build-dependencies]
└── perspective-server v4.3.0
    └── perspective v4.3.0
        └── rust-axum v4.3.0 (C:\Users\mrudang\TurboRust)
```

If you still see the crates.io version without a path, double-check that the `[patch.crates-io]`
section is in the **root** `Cargo.toml` of your workspace, not in a member crate's manifest.

---

## Step 7 — Clean and build

```powershell
cargo clean
cargo build
```

`cargo clean` is important — stale artifacts from a previous `protobuf-src` compilation attempt
can interfere with the patched build.

The C compilation of protobuf 27.1 from source will no longer run. The build will proceed
directly to compiling Rust code using your local `protoc`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `assertion failed: path.exists()` | The hardcoded path in `lib.rs` is wrong — recheck Step 1 |
| `cargo tree` still shows crates.io version | `[patch.crates-io]` is not in the workspace root `Cargo.toml` |
| `error: cannot patch a package with itself` | Your stub `name` or `version` doesn't match the locked version exactly |
| Build fails with missing `.proto` imports | The `include()` path is wrong — `perspective-server` may need google protobuf includes |
| `where.exe protoc` finds a shim under `WinGet\Links\` | Locate the real binary under `WinGet\Packages\Google.Protobuf_*\bin\` |

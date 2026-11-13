const nxPreset = require('@nx/jest/preset').default;
const path = require('path');

const projectName = process.env.NX_TASK_TARGET_PROJECT || 'unknown';

module.exports = {
  ...nxPreset,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        // Anchored to this file's directory (the workspace root): Nx 24's
        // inferred jest targets run with cwd = project root, so a relative
        // path would scatter the files into <project>/reports/.
        outputDirectory: path.join(__dirname, 'reports'),
        outputName: `${projectName}-junit.xml`,
        // File-path-based suite/class names so merged reports stay unique
        // across projects and CI publishers can link failures to files.
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{filepath}',
        titleTemplate: '{classname} › {title}',
        addFileAttribute: 'true',
      },
    ],
  ],
  coverageReporters: ['lcov', 'text-summary'],
};

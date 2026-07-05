const nxPreset = require('@nx/jest/preset').default;

const projectName = process.env.NX_TASK_TARGET_PROJECT || 'unknown';

module.exports = {
  ...nxPreset,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './reports',
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

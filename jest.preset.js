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
      },
    ],
  ],
  coverageReporters: ['lcov', 'text-summary'],
};

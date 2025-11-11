import { render } from '@testing-library/react';

import MacroReactGrid from './macro-react-grid';

describe('MacroReactGrid', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<MacroReactGrid />);
    expect(baseElement).toBeTruthy();
  });
});

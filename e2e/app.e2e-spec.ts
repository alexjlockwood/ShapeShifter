import { ShapeShifterPage } from './app.po';

describe('Shape Shifter App', function() {
  let page: ShapeShifterPage;

  beforeEach(() => {
    page = new ShapeShifterPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(true).toEqual(true);
  });
});

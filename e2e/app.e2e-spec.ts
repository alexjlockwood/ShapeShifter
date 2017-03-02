import { ShapeShifterPage } from './app.po';

describe('morpher App', function() {
  let page: ShapeShifterPage;

  beforeEach(() => {
    page = new ShapeShifterPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});

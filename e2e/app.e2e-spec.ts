import { MorpherPage } from './app.po';

describe('morpher App', function() {
  let page: MorpherPage;

  beforeEach(() => {
    page = new MorpherPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});

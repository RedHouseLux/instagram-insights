/**
 * Serves the dashboard. This runs under your own Google account, reading the "Instagram Insights" Sheet and
 * Drive folder this project is bound to — it needs the same Sheets/Drive access setup() already uses, not a
 * new permission. `?view=network` serves the same network graph the Sheet's own menu opens, as a full page.
 *
 * Deploy: Apps Script → Deploy → New deployment → Web app →
 *   Execute as: Me · Who has access: Only myself. Share the URL only with yourself.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.view === 'network') {
    const view = HtmlService.createTemplateFromFile('NetworkView');
    view.data = JSON.stringify(networkViewData_()).replace(/</g, '\\u003c');
    return view.evaluate()
      .setTitle('Your Instagram network')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Instagram Insights')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

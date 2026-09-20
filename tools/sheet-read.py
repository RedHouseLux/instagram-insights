"""Reads tabs from the Insights spreadsheet, using the token from sheet-auth.py.

    python3 tools/sheet-read.py                 # a summary of every tab
    python3 tools/sheet-read.py Log             # one tab in full
    python3 tools/sheet-read.py Monthly Weekly  # several

Read-only by construction: the token carries spreadsheets.readonly and nothing else.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN = os.path.join(HERE, '.oauth-token.json')
SHEET_NAME = 'SOCIAL MEDIA HEALTH'


def access_token():
    if not os.path.exists(TOKEN):
        raise SystemExit('No %s — run: python3 tools/sheet-auth.py' % TOKEN)
    saved = json.load(open(TOKEN))
    body = urllib.parse.urlencode({
        'client_id': saved['client_id'], 'client_secret': saved['client_secret'],
        'refresh_token': saved['refresh_token'], 'grant_type': 'refresh_token'}).encode()
    try:
        return json.load(urllib.request.urlopen('https://oauth2.googleapis.com/token', body))['access_token']
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf8', 'replace')[:200]
        raise SystemExit('Token refresh failed (%s). While the consent screen is in Testing, Google expires '
                         'refresh tokens after 7 days — re-run tools/sheet-auth.py.\n%s' % (e.code, detail))


def api(url, tok):
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + tok})
    return json.load(urllib.request.urlopen(req, timeout=60))


def find_sheet_id(tok):
    # The spreadsheet is located through Drive, which the clasp token can already list; but with a
    # spreadsheets-only scope we cannot search Drive, so the id is cached beside the token on first use.
    saved = json.load(open(TOKEN))
    if saved.get('spreadsheet_id'):
        return saved['spreadsheet_id']
    raise SystemExit('No spreadsheet id cached. Pass it once: python3 tools/sheet-read.py --id <SPREADSHEET_ID>')


def main():
    args = sys.argv[1:]
    tok = access_token()
    if args and args[0] == '--id':
        saved = json.load(open(TOKEN))
        saved['spreadsheet_id'] = args[1]
        json.dump(saved, open(TOKEN, 'w'), indent=2)
        print('Cached spreadsheet id.')
        return
    sid = find_sheet_id(tok)
    meta = api('https://sheets.googleapis.com/v4/spreadsheets/%s?fields=sheets(properties(title,gridProperties))' % sid, tok)
    titles = [s['properties']['title'] for s in meta['sheets']]
    wanted = args or titles
    for title in wanted:
        if title not in titles:
            print('\n== %s — no such tab (have: %s)' % (title, ', '.join(titles)))
            continue
        rng = urllib.parse.quote("'%s'!A1:ZZ2000" % title)
        vals = api('https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s' % (sid, rng), tok).get('values', [])
        print('\n== %s (%d rows incl. header)' % (title, len(vals)))
        for row in vals[:60]:
            print('   ' + ' | '.join(str(c) for c in row))
        if len(vals) > 60:
            print('   … %d more rows' % (len(vals) - 60))


main()

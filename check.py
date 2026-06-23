import re
app = open('app.js', encoding='utf-8').read()
idx = open('index.html', encoding='utf-8').read()
app_ids = re.findall(r"getElementById\('([^']+)'\)", app)
idx_ids = re.findall(r'id="([^"]+)"', idx)
dead = [x for x in app_ids if x not in idx_ids]
print('DEAD IDS:', set(dead))

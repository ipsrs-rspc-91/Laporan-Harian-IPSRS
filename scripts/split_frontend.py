from pathlib import Path
import re

ROOT = Path('frontend')
INDEX = ROOT / 'index.html'
PAGES = ROOT / 'pages'
CSS = ROOT / 'css'
LEGACY = ROOT / '_legacy'


def extract_tag(source: str, tag: str, element_id: str) -> str:
    pattern = re.compile(r'<(/?)' + re.escape(tag) + r'\b[^>]*>', re.I)
    wanted = re.compile(r'\bid=["\']' + re.escape(element_id) + r'["\']', re.I)
    start = None
    depth = 0
    for match in pattern.finditer(source):
        if not match.group(1):
            if start is None:
                if wanted.search(match.group(0)):
                    start = match.start()
                    depth = 1
            else:
                depth += 1
        elif start is not None:
            depth -= 1
            if depth == 0:
                return source[start:match.end()]
    raise RuntimeError(f'Element #{element_id} not found')


def main():
    html = INDEX.read_text(encoding='utf-8')
    PAGES.mkdir(exist_ok=True)
    CSS.mkdir(exist_ok=True)
    LEGACY.mkdir(exist_ok=True)

    backup = LEGACY / 'index-original.html'
    if not backup.exists():
        backup.write_text(html, encoding='utf-8')

    style = re.search(r'<style\b[^>]*>(.*?)</style>', html, re.I | re.S)
    if not style:
        raise RuntimeError('Shared style block not found')
    (CSS / 'style.css').write_text(style.group(1).strip() + '\n', encoding='utf-8')

    blocks = {
        'Page_Login.html': extract_tag(html, 'div', 'loginScreen'),
        'Page_Input.html': extract_tag(html, 'section', 'page-input'),
        'Page_Dashboard.html': extract_tag(html, 'section', 'page-dashboard'),
        'Page_Laporan.html': extract_tag(html, 'section', 'page-laporan'),
    }
    for name, content in blocks.items():
        (PAGES / name).write_text(content + '\n', encoding='utf-8')

    body_match = re.search(r'<body\b[^>]*>(.*?)</body>', html, re.I | re.S)
    if not body_match:
        raise RuntimeError('Body not found')
    body = body_match.group(1)
    body = body.replace(blocks['Page_Login.html'], '<div id="loginScreen" class="hidden"></div>', 1)
    body = body.replace(blocks['Page_Input.html'], '<section id="page-input" class="page active"></section>', 1)
    body = body.replace(blocks['Page_Dashboard.html'], '<section id="page-dashboard" class="page"></section>', 1)
    body = body.replace(blocks['Page_Laporan.html'], '<section id="page-laporan" class="page"></section>', 1)

    head_prefix = html[:html.find('<style')]
    after_style = html[style.end():]
    head_end = after_style.lower().find('</head>')
    if head_end < 0:
        raise RuntimeError('Head end not found')
    new_head = head_prefix + '<link rel="stylesheet" href="css/style.css">\n' + after_style[:head_end] + '</head>'

    loader = '''
  <script>
  (async function(){
    const mounts = {
      loginScreen: 'pages/Page_Login.html',
      'page-input': 'pages/Page_Input.html',
      'page-dashboard': 'pages/Page_Dashboard.html',
      'page-laporan': 'pages/Page_Laporan.html'
    };
    try {
      await Promise.all(Object.entries(mounts).map(async ([id, url]) => {
        const el = document.getElementById(id);
        if (!el) throw new Error('Mount point not found: ' + id);
        const res = await fetch(url, {cache:'no-store'});
        if (!res.ok) throw new Error('Gagal memuat ' + url + ' (' + res.status + ')');
        el.outerHTML = await res.text();
      }));
      const script = document.createElement('script');
      script.src = 'app.js';
      document.body.appendChild(script);
    } catch (err) {
      console.error(err);
      const loading = document.querySelector('.auth-loading-text');
      if (loading) loading.textContent = 'Gagal memuat aplikasi. Silakan muat ulang halaman.';
    }
  })();
  </script>
'''
    INDEX.write_text(new_head + '<body>' + body + loader + '</body>\n</html>\n', encoding='utf-8')
    print('IPSRS frontend split completed.')


if __name__ == '__main__':
    main()

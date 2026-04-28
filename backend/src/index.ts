import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database,
  MASTER_PASSWORD: string
}

const ALPHABET = '2345678abcdefghjkmnprstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const generateCode = (length = 5) => {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  }
  return result
}

// Password Hashing (SHA-256)
async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password + 's2gi-salt-2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors({
  origin: ['https://reserve.s2gi.net', 'https://stamp.s2gi.net', 'https://hoshimori-shokken.pages.dev', 'https://hoshinomori-reserve.pages.dev', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

const getGlobalSettings = async (DB: D1Database) => {
  return await DB.prepare('SELECT * FROM global_settings LIMIT 1').first()
}

const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  const settings = await getGlobalSettings(c.env.DB)
  const hashedToken = token ? await hashPassword(token) : ''
  if (!settings || hashedToken !== settings.admin_password) return c.json({ error: 'Unauthorized' }, 401)
  await next()
}

const urlAuthMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  const settings = await getGlobalSettings(c.env.DB)
  const hashedToken = token ? await hashPassword(token) : ''
  if (!settings || hashedToken !== (settings.url_admin_password || '')) return c.json({ error: 'Unauthorized' }, 401)
  await next()
}

app.post('/api/admin/verify', async (c) => {
  const { password } = await c.req.json()
  const settings = await getGlobalSettings(c.env.DB)
  const hashedPassword = await hashPassword(password)
  if (settings && hashedPassword === settings.admin_password) {
    return c.json({ success: true, requirePasswordChange: false })
  }
  return c.json({ success: false }, 401)
})

app.post('/api/admin/change-password', async (c) => {
  const { old_password, new_password } = await c.req.json()
  const settings = await getGlobalSettings(c.env.DB)
  const hashedOld = await hashPassword(old_password)
  if (!settings || hashedOld !== settings.admin_password) return c.json({ error: 'Unauthorized' }, 401)
  const hashedNew = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE global_settings SET admin_password = ?').bind(hashedNew).run()
  return c.json({ success: true })
})

// Master Password Reset
app.post('/api/admin/reset-password', async (c) => {
  const { master_password, new_password } = await c.req.json()
  if (master_password !== c.env.MASTER_PASSWORD) return c.json({ error: 'Invalid master password' }, 401)
  const hashedNew = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE global_settings SET admin_password = ?').bind(hashedNew).run()
  return c.json({ success: true })
})

// URL Admin Auth & Reset
app.post('/api/admin/url-verify', async (c) => {
  const { password } = await c.req.json()
  const settings = await getGlobalSettings(c.env.DB)
  const hashedPassword = await hashPassword(password)
  if (settings && hashedPassword === (settings.url_admin_password || '')) {
    return c.json({ success: true })
  }
  return c.json({ success: false }, 401)
})

app.post('/api/admin/url-reset-password', async (c) => {
  const { master_password, new_password } = await c.req.json()
  if (master_password !== c.env.MASTER_PASSWORD) return c.json({ error: 'Invalid master password' }, 401)
  const hashedNew = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE global_settings SET url_admin_password = ?').bind(hashedNew).run()
  return c.json({ success: true })
})

app.get('/api/settings', async (c) => {
  const result = await getGlobalSettings(c.env.DB)
  return c.json({ cafeteria_name: result?.cafeteria_name || '星の杜食堂' })
})

app.post('/api/admin/global-settings', authMiddleware, async (c) => {
  const { cafeteria_name } = await c.req.json()
  await c.env.DB.prepare('UPDATE global_settings SET cafeteria_name = ?').bind(cafeteria_name).run()
  return c.json({ success: true })
})

app.get('/api/admin/events', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT e.*, COUNT(r.id) as reservation_count 
    FROM events e 
    LEFT JOIN reservations r ON e.id = r.event_id 
    GROUP BY e.id 
    ORDER BY e.id DESC
  `).all()
  return c.json(results)
})

app.post('/api/admin/events', authMiddleware, async (c) => {
  const { slug, event_name, event_date, venue, start_time, capacity, end_time, classes, explanation_text } = await c.req.json()
  try {
    await c.env.DB.prepare(`
      INSERT INTO events (slug, event_name, event_date, venue, start_time, capacity, end_time, classes, explanation_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(slug, event_name, event_date, venue, start_time, capacity, end_time, JSON.stringify(classes), explanation_text).run()
    return c.json({ success: true })
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'このURLは既に使用されています' }, 400)
    return c.json({ error: 'エラーが発生しました' }, 500)
  }
})

app.put('/api/admin/events/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { slug, event_name, event_date, venue, start_time, capacity, end_time, classes, explanation_text } = await c.req.json()
  try {
    await c.env.DB.prepare(`
      UPDATE events SET slug = ?, event_name = ?, event_date = ?, venue = ?, start_time = ?, capacity = ?, end_time = ?, classes = ?, explanation_text = ?
      WHERE id = ?
    `).bind(slug, event_name, event_date, venue, start_time, capacity, end_time, JSON.stringify(classes), explanation_text, id).run()
    return c.json({ success: true })
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'このURLは既に使用されています' }, 400)
    return c.json({ error: 'エラーが発生しました' }, 500)
  }
})

app.delete('/api/admin/events/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')
  // 関連する予約を先に削除
  await c.env.DB.prepare('DELETE FROM reservations WHERE event_id = ?').bind(id).run()
  // イベント本体を削除
  await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.get('/api/admin/events/:id/reservations', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare('SELECT * FROM reservations WHERE event_id = ? ORDER BY ticket_number ASC').bind(id).all()
  return c.json(results)
})

app.get('/api/events/:slug', async (c) => {
  const slug = c.req.param('slug')
  const event: any = await c.env.DB.prepare('SELECT * FROM events WHERE slug = ?').bind(slug).first()
  if (!event) return c.json({ error: 'Event not found' }, 404)
  const g = await getGlobalSettings(c.env.DB)
  const { count }: any = await c.env.DB.prepare('SELECT COUNT(*) as count FROM reservations WHERE event_id = ?').bind(event.id).first()
  return c.json({
    ...event,
    classes: JSON.parse(event.classes as string),
    cafeteria_name: g?.cafeteria_name || '星の杜食堂',
    current_count: count
  })
})

app.post('/api/events/:slug/reserve', async (c) => {
  const slug = c.req.param('slug')
  const { class_name, child_name } = await c.req.json()
  const event: any = await c.env.DB.prepare('SELECT * FROM events WHERE slug = ?').bind(slug).first()
  if (!event) return c.json({ error: 'Event not found' }, 404)
  const now = new Date()
  if (now < new Date(event.start_time)) return c.json({ error: 'Not started' }, 403)
  if (now > new Date(event.end_time)) return c.json({ error: 'Closed' }, 403)
  const { count }: any = await c.env.DB.prepare('SELECT COUNT(*) as count FROM reservations WHERE event_id = ?').bind(event.id).first()
  if (count >= event.capacity) return c.json({ error: 'Full' }, 403)
  const duplicate = await c.env.DB.prepare(
    'SELECT id FROM reservations WHERE event_id = ? AND class_name = ? AND child_name = ?'
  ).bind(event.id, class_name, child_name).first()
  if (duplicate) return c.json({ error: 'Already reserved' }, 409)
  const ticket_number = count + 1
  await c.env.DB.prepare('INSERT INTO reservations (event_id, class_name, child_name, ticket_number) VALUES (?, ?, ?, ?)')
    .bind(event.id, class_name, child_name, ticket_number).run()
  return c.json({ success: true, ticket_number })
})

app.get('/api/admin/export', async (c) => {
  const id = c.req.query('id')
  const password = c.req.query('password')
  const settings = await getGlobalSettings(c.env.DB)
  if (!settings || password !== settings.admin_password) return new Response('Unauthorized', { status: 401 })
  const event: any = await c.env.DB.prepare('SELECT event_name, slug FROM events WHERE id = ?').bind(id).first()
  const { results } = await c.env.DB.prepare('SELECT * FROM reservations WHERE event_id = ? ORDER BY ticket_number ASC').bind(id).all()
  const headers = '\uFEFF食券番号,クラス,名前,予約日時\n'
  const rows = results.map(row => `${row.ticket_number},"${row.class_name}","${row.child_name}",${row.created_at}`).join('\n')
  return new Response(headers + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event?.slug || 'data'}.csv"`
    }
  })
})

// --- URL Shortener Admin API ---

app.get('/api/admin/urls', urlAuthMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM urls ORDER BY created_at DESC').all()
  return c.json(results)
})

app.post('/api/admin/urls', urlAuthMiddleware, async (c) => {
  const { original_url, custom_code } = await c.req.json()
  
  if (!original_url || (!original_url.startsWith('http://') && !original_url.startsWith('https://'))) {
    return c.json({ error: 'URLは http:// または https:// で始めてください' }, 400)
  }

  let short_code = custom_code

  if (!short_code) {
    // Generate unique code
    let attempts = 0
    while (attempts < 5) {
      short_code = generateCode(5)
      const existing = await c.env.DB.prepare('SELECT short_code FROM urls WHERE short_code = ?').bind(short_code).first()
      if (!existing) break
      attempts++
    }
  } else {
    // Validate custom code
    const existing = await c.env.DB.prepare('SELECT short_code FROM urls WHERE short_code = ?').bind(short_code).first()
    if (existing) return c.json({ error: 'このコードは既に使用されています' }, 400)
  }

  try {
    await c.env.DB.prepare('INSERT INTO urls (short_code, original_url) VALUES (?, ?)')
      .bind(short_code, original_url).run()
    return c.json({ success: true, short_code })
  } catch (e) {
    return c.json({ error: '保存に失敗しました' }, 500)
  }
})

app.delete('/api/admin/urls/:code', urlAuthMiddleware, async (c) => {
  const code = c.req.param('code')
  await c.env.DB.prepare('DELETE FROM urls WHERE short_code = ?').bind(code).run()
  return c.json({ success: true })
})

// --- Standalone Admin UI (go.s2gi.net/admin) ---

app.get('/admin', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>URL短縮システム 管理画面</title>
      <style>
        :root { --primary: #2563eb; --danger: #ef4444; --bg: #f8fafc; --card: #ffffff; --text: #1e293b; --muted: #64748b; }
        body { font-family: -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; line-height: 1.5; }
        .container { max-width: 800px; margin: 0 auto; }
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        h1 { font-size: 1.5rem; color: var(--primary); margin: 0; }
        .card { background: var(--card); padding: 25px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 5px; }
        input { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; box-sizing: border-box; font-size: 14px; }
        button { cursor: pointer; border: none; border-radius: 6px; padding: 10px 20px; font-weight: 600; transition: opacity 0.2s; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: var(--primary); color: white; width: 100%; }
        .btn-danger { background: var(--danger); color: white; padding: 5px 12px; font-size: 12px; }
        .btn-outline { background: transparent; border: 1px solid #e2e8f0; color: var(--muted); }
        .url-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #f1f5f9; }
        .url-item:last-child { border-bottom: none; }
        .url-info { flex: 1; min-width: 0; }
        .short-url { font-weight: bold; color: var(--primary); text-decoration: underline; cursor: pointer; }
        .long-url { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 4px 0; }
        .meta { font-size: 11px; color: #94a3b8; }
        #login-screen { max-width: 400px; margin: 100px auto; }
        .error { color: var(--danger); font-size: 13px; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container" id="app">
        <!-- Content will be injected by JS -->
        <div style="text-align:center; padding: 50px;">読み込み中...</div>
      </div>

      <script>
        const app = document.getElementById('app');
        let password = sessionStorage.getItem('admin_password') || '';
        let isLoggedIn = false;

        function escapeHtml(str) {
          const div = document.createElement('div');
          div.textContent = str;
          return div.innerHTML;
        }

        async function init() {
          if (password) {
            const res = await fetch('/api/admin/url-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (data.success) {
              isLoggedIn = true;
              renderMain();
              return;
            }
          }
          renderLogin();
        }

        function renderLogin(error = '') {
          app.innerHTML = \`
            <div id="login-screen" class="card">
              <h2 style="margin-top:0">管理者ログイン</h2>
              \${error ? \`<div class="error">\${error}</div>\` : ''}
              <form id="login-form">
                <div class="form-group">
                  <label>パスワード</label>
                  <input type="password" id="pass-input" required>
                </div>
                <button type="submit" class="btn-primary">ログイン</button>
                <div style="margin-top:15px; text-align:center;">
                  <a href="#" id="show-reset" style="color:#94a3b8; font-size:12px;">パスワードを忘れた場合</a>
                </div>
              </form>
            </div>
          \`;

          document.getElementById('show-reset').onclick = (e) => {
            e.preventDefault();
            renderReset();
          };

          document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const val = document.getElementById('pass-input').value;
            const res = await fetch('/api/admin/url-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: val })
            });
            const data = await res.json();
            if (data.success) {
              password = val;
              sessionStorage.setItem('admin_password', password);
              isLoggedIn = true;
              renderMain();
            } else {
              renderLogin('パスワードが間違っています');
            }
          };
        }

        function renderReset() {
          app.innerHTML = \`
            <div id="login-screen" class="card">
              <h2 style="margin-top:0">パスワード再設定</h2>
              <p style="font-size:12px; color:var(--muted); margin-bottom:15px;">マスターパスワードを使用して新しいパスワードを設定します。</p>
              <form id="reset-form">
                <div class="form-group">
                  <label>マスターパスワード</label>
                  <input type="password" id="master-pass" required>
                </div>
                <div class="form-group">
                  <label>新しいパスワード</label>
                  <input type="password" id="new-pass" required>
                </div>
                <button type="submit" class="btn-primary">パスワードを更新</button>
                <div style="margin-top:15px; text-align:center;">
                  <a href="#" id="back-login" style="color:#94a3b8; font-size:12px;">ログインに戻る</a>
                </div>
              </form>
            </div>
          \`;

          document.getElementById('back-login').onclick = (e) => {
            e.preventDefault();
            renderLogin();
          };

          document.getElementById('reset-form').onsubmit = async (e) => {
            e.preventDefault();
            const res = await fetch('/api/admin/url-reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                master_password: document.getElementById('master-pass').value,
                new_password: document.getElementById('new-pass').value
              })
            });
            if (res.ok) {
              alert('更新しました。新しいパスワードでログインしてください。');
              renderLogin();
            } else {
              alert('マスターパスワードが違います');
            }
          };
        }

        async function renderMain() {
          app.innerHTML = \`
            <header>
              <h1>URL短縮システム</h1>
              <button onclick="logout()" class="btn-outline">ログアウト</button>
            </header>
            <div class="card">
              <h3 style="margin-top:0">新規URL作成</h3>
              <form id="create-form">
                <div class="form-group">
                  <label>元のURL</label>
                  <input type="url" id="long-url" placeholder="https://..." required>
                </div>
                <div class="form-group">
                  <label>短縮コード (任意)</label>
                  <input type="text" id="custom-code" placeholder="空欄で自動発行">
                </div>
                <button type="submit" class="btn-primary" id="submit-btn">作成する</button>
              </form>
            </div>
            <div id="list-container">読み込み中...</div>
          \`;

          document.getElementById('create-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submit-btn');
            btn.disabled = true;
            const res = await fetch('/api/admin/urls', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + password },
              body: JSON.stringify({
                original_url: document.getElementById('long-url').value,
                custom_code: document.getElementById('custom-code').value
              })
            });
            if (res.ok) {
              fetchList();
              document.getElementById('create-form').reset();
            } else {
              const data = await res.json();
              alert(data.error || 'エラー');
            }
            btn.disabled = false;
          };

          fetchList();
        }

        async function fetchList() {
          const container = document.getElementById('list-container');
          const res = await fetch('/api/admin/urls', {
            headers: { 'Authorization': 'Bearer ' + password }
          });
          const data = await res.json();
          
          if (data.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;">まだ登録がありません</div>';
            return;
          }

          container.innerHTML = \`
            <div class="card" style="padding:0">
              \${data.map(item => \`
                <div class="url-item">
                  <div class="url-info">
                    <div class="short-url" onclick="copy('https://go.s2gi.net/\${escapeHtml(item.short_code)}')">go.s2gi.net/\${escapeHtml(item.short_code)}</div>
                    <div class="long-url">\${escapeHtml(item.original_url)}</div>
                    <div class="meta">\${new Date(item.created_at).toLocaleString()} | クリック: \${item.clicks}</div>
                  </div>
                  <button onclick="del('\${escapeHtml(item.short_code)}')" class="btn-danger">削除</button>
                </div>
              \`).join('')}
            </div>
          \`;
        }

        window.copy = (text) => {
          navigator.clipboard.writeText(text);
          alert('コピーしました: ' + text);
        };

        window.del = async (code) => {
          if (!confirm('削除しますか？')) return;
          await fetch('/api/admin/urls/' + code, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + password }
          });
          fetchList();
        };

        window.logout = () => {
          sessionStorage.removeItem('admin_password');
          location.reload();
        };

        init();
      </script>
    </body>
    </html>
  `)
})

// --- Redirect Logic ---

app.get('/:short_code', async (c) => {
  const short_code = c.req.param('short_code')
  const host = new URL(c.req.url).hostname

  // go.st2g.net の場合は最優先で短縮URLを探す
  const urlEntry: any = await c.env.DB.prepare('SELECT original_url FROM urls WHERE short_code = ?').bind(short_code).first()
  
  if (urlEntry) {
    // クリック数をカウント
    await c.env.DB.prepare('UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?').bind(short_code).run()
    return c.redirect(urlEntry.original_url)
  }

  // 短縮URLが見つからず、かつ go.s2gi.net 経由の場合はエラー画面
  if (host === 'go.s2gi.net' || host === 'localhost' || host.includes('workers.dev')) {
    // もし予約システムの slug かもしれないので、念のためチェック
    const event: any = await c.env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(short_code).first()
    if (!event) {
      // どちらでもない場合はエラー画面
      return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Invalid</title>
          <style>
            body { 
              font-family: -apple-system, "Segoe UI", Roboto, sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              background: #ffffff; 
              color: #1a1a1a;
            }
            .content { 
              text-align: center; 
              animation: fadeIn 0.8s ease-out;
            }
            h1 { 
              font-size: 14px; 
              font-weight: 400; 
              letter-spacing: 0.1em; 
              text-transform: uppercase;
              margin-bottom: 8px;
              color: #a0a0a0;
            }
            p { 
              font-size: 18px; 
              font-weight: 300;
              margin: 0;
              color: #404040;
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          </style>
        </head>
        <body>
          <div class="content">
            <h1>Link Invalid</h1>
            <p>このリンクは現在無効です。</p>
          </div>
        </body>
        </html>
      `)
    }
  }

  // それ以外の場合は何もしない
  return c.notFound()
})

export default app

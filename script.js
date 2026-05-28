document.addEventListener('DOMContentLoaded', () => {

    // --- 0. Supabase ---
    const SUPABASE_URL = 'https://membgduqkvqhfgruqbvb.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lbWJnZHVxa3ZxaGZncnVxYnZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzY3MTYsImV4cCI6MjA5NTQ1MjcxNn0.CVJW9N5X4ecY3JS4ywBCy6XGJRUbOOISf7vyX1euQaw';
    const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

    // --- 1. デジタル時計（Home） ---
    function updateClock() {
        const clockElement = document.getElementById('clock');
        if (clockElement) {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            clockElement.textContent = `${h}:${m}:${s}`;
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- 2. Diary 投稿 ---
    const placeholders = [
        '今、何を考えていますか？ / What\'s on your mind?',
        '本日もお疲れ様です。 / Good work today.',
        'AかBかと聞かれたら、Cと答える。 / If asked A or B, I\'d say C.',
        '今、何を見ていますか / What are you looking at?',
        'まだ起きているんですか / You\'re still awake?',
        '今日はどこへ行きましたか / Where did you go today?',
        'あの夜を覚えていますか / Do you remember that night?',
        '最近ちゃんと眠れてますか / Have you been sleeping well?',
        '何を考えて歩いてますか / What are you thinking as you walk?',
        'あなたは何を探してるの / What are you looking for?',
        '今日は少し疲れてますか / Are you a little tired today?',
        'どんな朝を待っていますか / What kind of morning are you waiting for?',
    ];
    const diaryInputEl = document.getElementById('diary-input');
    if (diaryInputEl) {
        diaryInputEl.placeholder = placeholders[Math.floor(Math.random() * placeholders.length)];
    }

    const postButton = document.getElementById('post-button');
    const diaryInput = document.getElementById('diary-input');
    const diaryNameInput = document.getElementById('diary-name');
    const diaryContainer = document.getElementById('diary-container');

    async function renderDiaries() {
        if (!diaryContainer || !db) return;

        const { data: entries, error } = await db
            .from('entries')
            .select('*')
            .order('id', { ascending: false });

        if (error) { console.error(error); return; }

        diaryContainer.innerHTML = '';
        if (!entries || entries.length === 0) return;

        function parseEntryTime(dateStr) {
            const raw = dateStr.includes('—') ? dateStr.split('—')[1].trim() : dateStr.trim();
            const [datePart, timePart] = raw.split('  ');
            if (!datePart || !timePart) return 0;
            const [y, m, d] = datePart.split('.');
            const [h, min] = timePart.split(':');
            return new Date(y, m - 1, d, h, min).getTime();
        }

        entries.sort((a, b) => {
            const aOld = Date.now() - parseEntryTime(a.date) > 24 * 60 * 60 * 1000;
            const bOld = Date.now() - parseEntryTime(b.date) > 24 * 60 * 60 * 1000;
            if (aOld && !bOld) return 1;
            if (!aOld && bOld) return -1;
            return 0;
        });

        const containerWidth = diaryContainer.offsetWidth || window.innerWidth * 0.9;
        const isMobile = containerWidth < 600;
        const colCount = isMobile ? 2 : Math.max(1, Math.floor(containerWidth / 240));
        const noteWidth = isMobile ? Math.floor((containerWidth - 50) / 2) : 210;
        const colWidth = containerWidth / colCount;
        const columnHeights = new Array(colCount).fill(20);
        const xJitter = isMobile ? 10 : 40;
        let maxBottom = 0;

        diaryContainer.style.position = 'relative';

        let topZ = 1;
        const myIds = JSON.parse(localStorage.getItem('my-post-ids') || '[]');

        // パス1: カードを生成してDOMに追加（非表示）
        const cards = entries.map(entry => {
            const item = document.createElement('div');
            item.className = 'diary-item sticky-note';
            item.style.visibility = 'hidden';
            item.style.width = `${noteWidth}px`;
            item.style.cursor = 'grab';
            item.style.background = 'var(--white)';

            const rawDate = entry.date.includes('—') ? entry.date.split('—')[1].trim() : entry.date.trim();
            const [datePart, timePart] = rawDate.split('  ');
            if (datePart && timePart) {
                const [y2, m, d] = datePart.split('.');
                const [h, min] = timePart.split(':');
                const entryTime = new Date(y2, m - 1, d, h, min);
                if (Date.now() - entryTime > 24 * 60 * 60 * 1000) {
                    item.style.background = '#d8d8d8';
                    item.style.color = '#888';
                }
            }

            const date = document.createElement('span');
            date.className = 'date';
            date.textContent = entry.date;

            const text = document.createElement('p');
            text.style.fontSize = '0.85rem';
            text.textContent = entry.text;

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.style.cssText = `position: absolute; top: 0.5rem; right: 0.5rem; width: 1.4rem; height: 1.4rem; padding: 0; font-size: 0.75rem; font-weight: normal; line-height: 1; display: ${myIds.includes(entry.id) ? 'block' : 'none'};`;
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await db.from('entries').delete().eq('id', entry.id);
                const updated = myIds.filter(id => id !== entry.id);
                localStorage.setItem('my-post-ids', JSON.stringify(updated));
                renderDiaries();
            });

            function startDrag(clientX, clientY) {
                item.style.cursor = 'grabbing';
                item.style.zIndex = ++topZ;
                const startX = clientX - item.offsetLeft;
                const startY = clientY - item.offsetTop;
                function onMouseMove(e) { move(e.clientX, e.clientY); }
                function onTouchMove(e) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }
                function move(cx, cy) {
                    item.style.left = `${cx - startX}px`;
                    item.style.top  = `${cy - startY}px`;
                    const bottom = (cy - startY) + item.offsetHeight + 40;
                    if (bottom > parseInt(diaryContainer.style.height)) diaryContainer.style.height = `${bottom}px`;
                }
                function onEnd() {
                    item.style.cursor = 'grab';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onEnd);
                    document.removeEventListener('touchmove', onTouchMove);
                    document.removeEventListener('touchend', onEnd);
                }
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onEnd);
                document.addEventListener('touchmove', onTouchMove, { passive: false });
                document.addEventListener('touchend', onEnd);
            }

            item.addEventListener('mousedown', (e) => { if (e.target !== deleteBtn) { e.preventDefault(); startDrag(e.clientX, e.clientY); } });
            item.addEventListener('touchstart', (e) => { if (e.target !== deleteBtn) startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

            item.appendChild(date);
            item.appendChild(text);
            item.appendChild(deleteBtn);
            diaryContainer.appendChild(item);
            return item;
        });

        // パス2: 実際の高さを測ってマスonry配置
        cards.forEach(item => {
            const col = columnHeights.indexOf(Math.min(...columnHeights));
            const x = col * colWidth + (colWidth - noteWidth) / 2 + (Math.random() - 0.5) * xJitter;
            const y = columnHeights[col] + Math.random() * 15;
            const gap = 15 + Math.random() * 20;
            columnHeights[col] += item.offsetHeight + gap;
            const rotate = (Math.random() - 0.5) * 4;
            item.style.left = `${Math.max(0, x)}px`;
            item.style.top = `${y}px`;
            item.style.transform = `rotate(${rotate}deg)`;
            item.style.visibility = 'visible';
        });

        diaryContainer.style.height = `${Math.max(...columnHeights) + 40}px`;
    }

    // diary-log.html での表示
    if (!postButton && diaryContainer) {
        renderDiaries();
    }

    if (postButton && diaryInput) {
        postButton.addEventListener('click', async () => {
            const text = diaryInput.value.trim();
            if (!text || !db) return;

            const name = diaryNameInput ? diaryNameInput.value.trim() : '';
            const now = new Date();
            const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const date = name ? `${name}  —  ${dateStr}` : dateStr;

            const { data, error } = await db.from('entries').insert([{ date, text }]).select();
            if (!error && data && data[0]) {
                const myIds = JSON.parse(localStorage.getItem('my-post-ids') || '[]');
                myIds.push(data[0].id);
                localStorage.setItem('my-post-ids', JSON.stringify(myIds));
                window.location.href = 'diary-log.html';
            }
        });
    }

    // --- 3. Contact フォーム送信 ---
    const contactForm = document.getElementById('contact-form');
    const contactThanks = document.getElementById('contact-thanks');

    if (contactForm && contactThanks) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(contactForm);
            const response = await fetch('https://formspree.io/f/mredrgqy', {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                contactForm.style.display = 'none';
                contactThanks.style.display = 'block';
            }
        });
    }
});

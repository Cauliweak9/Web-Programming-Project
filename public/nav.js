(function () {
    const labels = {
        brand: '校园二手交易平台',
        market: '商品大厅',
        publish: '发布商品',
        myProducts: '我的发布',
        orders: '我的订单',
        api: '开放 API 示例',
        skill: 'Skill 示例',
        profile: '个人信息',
        admin: '后台管理',
        login: '登录',
        register: '注册',
        logout: '退出登录'
    };

    const links = [
        { href: '/index.html', text: labels.market },
        { href: '/publish-product.html', text: labels.publish, auth: true },
        { href: '/my-products.html', text: labels.myProducts, auth: true },
        { href: '/dashboard.html', text: labels.orders, auth: true },
        { href: '/third-party-demo.html', text: labels.api },
        { href: '/skill-demo.html', text: labels.skill },
        { href: '/profile.html', text: labels.profile, auth: true },
        { href: '/admin.html', text: labels.admin, admin: true }
    ];

    function ensureStyle() {
        if (document.getElementById('globalNavStyle')) return;
        const style = document.createElement('style');
        style.id = 'globalNavStyle';
        style.textContent = `
            .global-nav {
                background: #4f46e5;
                color: #fff;
                padding: 14px 20px;
                box-shadow: 0 2px 10px rgba(15, 23, 42, .16);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
                font-family: Arial, "Microsoft YaHei", "PingFang SC", sans-serif;
            }
            .global-nav a { text-decoration: none; }
            .global-nav__brand {
                color: #fff;
                font-size: 20px;
                line-height: 1.2;
                font-weight: 900;
                white-space: nowrap;
            }
            .global-nav__links {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 8px;
                flex-wrap: wrap;
            }
            .global-nav__link {
                color: rgba(255, 255, 255, .92);
                border-radius: 6px;
                padding: 8px 10px;
                font-size: 14px;
                font-weight: 700;
                line-height: 1;
            }
            .global-nav__link:hover,
            .global-nav__link.is-active {
                color: #fff;
                background: rgba(255, 255, 255, .18);
            }
            .global-nav__logout {
                border: 0;
                border-radius: 6px;
                background: #ef4444;
                color: #fff;
                padding: 9px 14px;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
            }
            .global-nav__user {
                color: rgba(255, 255, 255, .92);
                font-size: 14px;
                font-weight: 700;
                padding: 8px 4px;
            }
            .global-nav__logout:hover { background: #dc2626; }
            @media (max-width: 720px) {
                .global-nav { align-items: flex-start; }
                .global-nav__links { justify-content: flex-start; }
            }
        `;
        document.head.appendChild(style);
    }

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch (e) {
            return {};
        }
    }

    function isLoggedIn() {
        return !!(localStorage.getItem('jwt_token') || localStorage.getItem('token'));
    }

    function isAdmin() {
        const user = getUser();
        return user.role === 'ADMIN' || localStorage.getItem('role') === 'ADMIN';
    }

    function isActive(href) {
        const path = window.location.pathname;
        const page = path.endsWith('/') ? '/index.html' : path;
        return page === href;
    }

    function render() {
        const nav = document.querySelector('nav');
        if (!nav) return;

        ensureStyle();

        const loggedIn = isLoggedIn();
        const admin = isAdmin();
        const visibleLinks = links.filter((link) => {
            if (link.auth && !loggedIn) return false;
            if (link.admin && !admin) return false;
            return true;
        });

        const linkHtml = visibleLinks.map((link) => {
            const active = isActive(link.href) ? ' is-active' : '';
            return `<a class="global-nav__link${active}" href="${link.href}">${link.text}</a>`;
        }).join('');

        const user = getUser();
        const displayName = user.nickname || user.email || '';
        const userHtml = displayName ? `<span class="global-nav__user">${displayName}</span>` : '';
        const accountHtml = loggedIn
            ? `${userHtml}<button id="globalLogoutButton" class="global-nav__logout">${labels.logout}</button>`
            : `<a class="global-nav__link${isActive('/login.html') ? ' is-active' : ''}" href="/login.html">${labels.login}</a><a class="global-nav__link${isActive('/register.html') ? ' is-active' : ''}" href="/register.html">${labels.register}</a>`;

        nav.className = 'global-nav';
        nav.innerHTML = `
            <a href="/index.html" class="global-nav__brand">${labels.brand}</a>
            <div class="global-nav__links">${linkHtml}${accountHtml}</div>
        `;

        const logoutButton = document.getElementById('globalLogoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', function () {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('role');
                window.location.href = '/login.html';
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
}());

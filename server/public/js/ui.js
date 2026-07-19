// Single UI module for the client: message box, UI locking, navigation, HTML escaping,
// formatters, asset URLs, shared render helpers, content card, navbar, auth card, and the
// modal builders. Consolidated here so every page imports its UI from one place.

import { UserInfo } from './api/models.js';

//=============== HTML escaping ===============

/**
 * Escapes HTML-special characters so untrusted text is safe to inject as innerHTML.
 * @param {*} value - Any value; null/undefined become an empty string.
 * @returns {string}
 */
export function escapeHtml(value)
{
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

//=============== Asset URLs ===============
// The server serves public/ at the web root, so absolute /assets/... paths resolve the
// same from every page depth.
const ASSETS_BASE = '/assets';

export function coverUrl(fileName)
{
    return `${ASSETS_BASE}/covers/${fileName}`;
}

export function profileImageUrl(fileName)
{
    return `${ASSETS_BASE}/profiles_images/${fileName}`;
}

export function videoUrl(fileName)
{
    return `${ASSETS_BASE}/videos/${fileName}`;
}

//=============== Display formatters ===============

/** Formats a release date as a US-style date, or "Unknown" for missing/invalid values. */
export function formatReleaseDate(date)
{
    if (date instanceof Date && !isNaN(date))
    {
        return date.toLocaleDateString('en-US');
    }
    return 'Unknown';
}

/** Joins categories with ", ", falling back to "No category" when empty. */
export function formatCategories(categories)
{
    if (Array.isArray(categories) && categories.length > 0)
    {
        return categories.join(', ');
    }
    return 'No category';
}

/** Formats a numeric rating with a single decimal place. */
export function formatRating(value)
{
    return value.toFixed(1);
}

//=============== Message box ===============

/** Looks up the message box fresh each time, since it may not exist yet when this module loads. */
function getMessageBox()
{
    return document.getElementById('msg_box');
}

/** Displays a standard informative message in the UI. */
export function showMessage(message)
{
    const messageBoxElement = getMessageBox();
    if (messageBoxElement) messageBoxElement.innerHTML = `<div class="msg">${message}</div>`;
    else console.log("Message box not found: ", messageBoxElement);
}

/** Displays an error-styled message in the UI. */
export function showErrorMessage(message)
{
    const messageBoxElement = getMessageBox();
    if (messageBoxElement) messageBoxElement.innerHTML = `<div class="msg error">${message}</div>`;
    else console.log("Message box not found: ", messageBoxElement);
}

/** Removes all content from the message box. */
export function clearMessage()
{
    const messageBoxElement = getMessageBox();
    if (messageBoxElement) messageBoxElement.innerHTML = '';
}
//=============== UI locking ===============

export let isUiLocked = false;
let lastClickedButton = null;
let originalButtonHtml = "";
const spinnerHtml = '<div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>';

/** Disables/enables all interactive elements to prevent input during async work. */
export function toggleUiLock(shouldLock)
{
    isUiLocked = shouldLock;
    document.querySelectorAll('button, input, textarea, select').forEach(element =>
    {
        element.disabled = shouldLock;
    });
    document.querySelectorAll('a, .movie_image, .profile_image').forEach(clickableElement =>
    {
        clickableElement.style.pointerEvents = shouldLock ? "none" : "auto";
    });
}

/** Locks the UI and shows a spinner on the triggering button, if given. */
export function lockUi(triggerButton = null)
{
    if (isUiLocked)
    {
        console.log("UI is already locked");
        return;
    }
    if (triggerButton)
    {
        lastClickedButton = triggerButton;
        originalButtonHtml = triggerButton.innerHTML;
        triggerButton.innerHTML = spinnerHtml;
    }
    toggleUiLock(true);
}

/** Releases the UI lock and restores the triggering button's content. */
export function unlockUi()
{
    if (!isUiLocked)
    {
        console.log("UI is not locked");
        return;
    }
    if (lastClickedButton)
    {
        lastClickedButton.innerHTML = originalButtonHtml;
        lastClickedButton = null;
    }
    toggleUiLock(false);
}

/**
 * Canonical wrapper for a user-triggered async action: locks before, unlocks after.
 * Ignores the call if the UI is already locked, so double-clicks are naturally debounced.
 * @param {HTMLElement|null} triggerElement - Element to show the spinner on (optional).
 * @param {Function} asyncFn - The async work to run while locked.
 */
export async function withUiLock(triggerElement, asyncFn)
{
    if (isUiLocked) return;
    lockUi(triggerElement);
    try
    {
        return await asyncFn();
    }
    finally
    {
        unlockUi();
    }
}

//=============== Navigation ===============

/**
 * Navigates to a URL, playing the auth card's exit animation first when present.
 * @param {string} targetUrl - The destination path or URL.
 */
export function goToLink(targetUrl)
{
    const EXIT_ANIMATION_DELAY_MS = 125;
    const menuContainer = document.querySelector('.menu-container');

    if (menuContainer)
    {
        // Reset the animation so it can re-trigger, then play the exit class.
        menuContainer.style.animation = 'none';
        menuContainer.offsetHeight;
        menuContainer.style.animation = null;
        menuContainer.classList.add('menu-exit');
        setTimeout(() => { window.location.href = targetUrl; }, EXIT_ANIMATION_DELAY_MS);
    }
    else
    {
        window.location.href = targetUrl;
    }
}

// Intercept internal <a> navigation to play the exit animation first (not #anchors/new tabs).
document.addEventListener('click', (event) =>
{
    const link = event.target.closest('a');
    if (link && link.href &&
        !link.href.startsWith('javascript') &&
        !link.href.includes('#') &&
        link.target !== "_blank")
    {
        event.preventDefault();
        if (isUiLocked) return;
        goToLink(link.href);
    }
});

//=============== Shared render helpers ===============

/**
 * Renders a simple centered "empty result" placeholder into a grid/list container.
 * @param {HTMLElement} container - The element whose contents are replaced.
 * @param {string} text - The message to show.
 * @param {string} [classNames='col-12 text-center'] - Classes for the placeholder cell.
 */
export function renderEmptyState(container, text, classNames = 'col-12 text-center')
{
    if (!container) return;
    container.innerHTML = `<div class="${classNames}" dir="ltr">${text}</div>`;
}

/**
 * Returns true when a backend response succeeded; logs a labeled error otherwise.
 * @param {Object} response - The backend response ({ success, message, ... }).
 * @param {string} actionLabel - What we were trying to do (for the error log).
 */
export function isOk(response, actionLabel)
{
    if (response && response.success) return true;
    console.error(`Failed to ${actionLabel}: `, (response && response.message) || "Unknown error");
    return false;
}

/**
 * Builds one labeled "label : value" detail row, shared by the profile and admin pages.
 * @returns {string} HTML markup.
 */
export function renderField(label, value, separator = ':', labelClass = 'text-danger', valueClass = 'text-white')
{
    return `
    <div class="label_item border border-white rounded-pill p-2 w-100 m-2" dir="ltr"
         style="display: grid; grid-template-columns: 5fr 1fr 6fr; align-items: center; column-gap: 0.5rem;">
        <div class="text-center ${labelClass} fw-bold fs-4" style="overflow-wrap: break-word; word-break: break-word;">${label}</div>
        <div class="text-center text-warning fw-bold fs-4">${separator}</div>
        <div class="text-center ${valueClass} fs-5" style="overflow-wrap: break-word; word-break: break-word;">${value}</div>
    </div>
`;
}

//=============== Content card ===============

/**
 * Builds a like/unlike button. The grid variant shows a "(like)/(unlike)" label; the
 * detail variant shows the emoji only. Clicks are handled via delegation using
 * data-action="like" + data-content-id.
 */
export function renderLikeButton({ contentId, likes, isLiked, showLabel = true, extraClasses = '', type = null })
{
    const variantClass = isLiked ? 'btn-danger' : 'btn-outline-danger';
    const likesText = escapeHtml(likes);

    let inner;
    if (isLiked)
    {
        inner = showLabel ? `${likesText} 💔(unlike)` : `${likesText} 💔`;
    }
    else
    {
        inner = showLabel ? `${likesText} ❤️(like)` : `${likesText} ❤️`;
    }

    const typeAttr = type ? ` type="${type}"` : '';
    const classes = `btn btn-sm ${variantClass} ${extraClasses}`.trim();
    return `<button${typeAttr} class="${classes}" data-action="like" data-content-id="${escapeHtml(contentId)}">${inner}</button>`;
}

/**
 * Generic tile used by the profile content grid and the admin selection list.
 * Clicks are handled via delegation using data-action + data-content-id on the image.
 */
export function renderCard({
    id,
    imageUrl,
    title,
    subtitle = '',
    footerHtml = '',
    action = 'open',
    columnClass = 'col-6 col-sm-4 col-md-3 col-lg-2 mb-4'
} = {})
{
    const safeTitle = escapeHtml(title);
    const safeId = escapeHtml(id);
    const subtitleHtml = subtitle
        ? `<div class="content_subtitle text-center text-truncate px-1">${escapeHtml(subtitle)}</div>`
        : '';

    return `
            <div class="${columnClass} content_item">
                <img src="${escapeHtml(imageUrl)}" class="img-fluid rounded content_image" alt="${safeTitle}" data-action="${escapeHtml(action)}" data-content-id="${safeId}">
                <div class="content_name text-center text-truncate px-1">${safeTitle}</div>
                ${subtitleHtml}
                ${footerHtml}
            </div>
        `;
}

/**
 * Builds a single content grid card (cover, title, like button). The card opens details via
 * data-action="open" + data-content-id, handled by delegation.
 */
export function renderContentCard(item, { isLiked, showLikeLabel = true } = {})
{
    const likeButton = renderLikeButton({
        contentId: item.id,
        likes: item.likes,
        isLiked,
        showLabel: showLikeLabel,
        extraClasses: 'w-100 mt-2'
    });

    return renderCard({
        id: item.id,
        imageUrl: coverUrl(item.cover_image_name),
        title: item.title,
        footerHtml: likeButton,
        action: 'open',
        columnClass: 'col-6 col-sm-4 col-md-3 col-lg-2 mb-4'
    });
}

/**
 * Wide horizontal selection row (admin users/content/reviews list).
 * Same shape for every mode; clicks use data-action + data-content-id on the row.
 */
export function renderWideCard({ id, imageUrl, title, subtitle = '', action = 'select' } = {})
{
    const safeTitle = escapeHtml(title);
    const safeId = escapeHtml(id);
    const subtitleHtml = subtitle
        ? `<div class="content_subtitle text-truncate">${escapeHtml(subtitle)}</div>`
        : '';

    return `
            <div class="col-12 content_item">
                <div class="d-flex align-items-center gap-3 w-100 p-2 rounded border border-secondary bg-black bg-opacity-50 text-start"
                     data-action="${escapeHtml(action)}" data-content-id="${safeId}">
                    <img src="${escapeHtml(imageUrl)}" class="rounded selection-thumb" alt="${safeTitle}">
                    <div class="flex-grow-1 min-w-0">
                        <div class="content_name fw-bold text-light text-truncate m-0">${safeTitle}</div>
                        ${subtitleHtml}
                    </div>
                </div>
            </div>
        `;
}

//=============== Navbar ===============

/**
 * Injects a data-driven navbar. Each page supplies its own brand, nav items, and optional
 * right-side controls, so browse and admin share one implementation.
 * @param {HTMLElement} rootEl - The mount element (e.g. #navbar_root or #mode_selector_container).
 * @param {Object} config
 * @param {{href?:string,imgSrc?:string,width?:number}} [config.brand]
 * @param {Array<{id?:string,label:string,href?:string,onClick?:Function,active?:boolean,highlight?:boolean}>} [config.items]
 * @param {string} [config.rightHtml] - Raw markup for the right side (search/profile controls).
 * @param {boolean} [config.fixed=true] - Whether the navbar is fixed to the top.
 * @param {boolean} [config.distributeItems=false] - Evenly space items across the bar (admin mode switcher).
 * @returns {HTMLElement|null} The mount element.
 */
export function renderNavbar(rootEl, config = {})
{
    if (!rootEl) return null;

    const {
        brand = { href: '#', imgSrc: '/assets/netflix_logo.png', width: 60 },
        items = [],
        rightHtml = '',
        fixed = true,
        distributeItems = false
    } = config;

    const itemLiClass = distributeItems ? 'nav-item flex-fill text-center' : 'nav-item';
    const itemsHtml = items.map(item =>
    {
        const activeClass = item.active ? ' active' : '';
        const highlightClass = item.highlight ? ' text-warning' : '';
        const idAttr = item.id ? ` id="${item.id}"` : '';
        const hrefAttr = ` href="${item.href ?? '#'}"`;
        return `<li class="${itemLiClass}"><a class="nav-link fs-6${activeClass}${highlightClass}"${idAttr}${hrefAttr}>${escapeHtml(item.label)}</a></li>`;
    }).join('\n                    ');

    const positionClass = fixed ? 'fixed-top' : '';
    const navListClass = distributeItems
        ? 'navbar-nav w-100 flex-row flex-wrap align-items-center justify-content-evenly'
        : 'navbar-nav me-auto flex-row flex-wrap gap-3 align-items-center';

    rootEl.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-black bg-opacity-75 ${positionClass}">
        <div class="container-fluid">
            <a class="navbar-brand px-2" href="${brand.href ?? '#'}"><img src="${brand.imgSrc ?? '/assets/netflix_logo.png'}" width="${brand.width ?? 60}" alt="logo"></a>

            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="${navListClass}">
                    ${itemsHtml}
                </ul>
            </div>

            <div class="d-flex align-items-center order-lg-last">
                ${rightHtml}
            </div>
        </div>
    </nav>
    `;

    // Wire per-item click handlers (used by pages whose items are actions, e.g. admin modes).
    items.forEach(item =>
    {
        if (item.onClick && item.id)
        {
            const element = rootEl.querySelector(`#${item.id}`);
            if (element) element.addEventListener('click', item.onClick);
        }
    });

    return rootEl;
}

//=============== Auth card shell ===============

/**
 * Replaces a placeholder element with the shared row + menu-container auth card shell.
 * @param {HTMLElement} rootEl - Placeholder element (e.g. #auth_root) to replace.
 * @param {Object} [options]
 * @param {string} [options.dir='ltr']
 * @param {string} [options.rounded='rounded-1']
 * @param {string} [options.padding='p-4']
 * @param {string} [options.rowClasses]
 * @param {string} [options.extraCardClasses=''] - Extra Bootstrap/utility classes on the card (e.g. width).
 * @param {string} innerHtml - The page-specific inner markup.
 */
export function renderAuthCard(rootEl, {
    dir = 'ltr',
    rounded = 'rounded-1',
    padding = 'p-4',
    rowClasses = 'row w-100 justify-content-center min-vh-100 align-items-center',
    extraCardClasses = ''
} = {}, innerHtml = '')
{
    if (!rootEl) return;

    const cardClasses = `menu-container w-auto bg-black bg-opacity-75 text-light ${rounded} shadow ${padding} d-grid gap-2 ${extraCardClasses}`.trim();

    rootEl.outerHTML = `
    <div class="${rowClasses}">
        <div class="${cardClasses}" dir="${dir}">
            ${innerHtml}
        </div>
    </div>
    `;
}

//=============== Modal: shared class constants ===============

export const FIELD_ITEM_CLASSES = "col-12 d-flex justify-content-between align-items-center border border-secondary p-2 m-2";
export const LABEL_CLASSES = "text-start fw-bold fs-5 text-secondary";
export const INPUT_CLASSES = "form-control w-75";
export const SELECT_CLASSES = "form-select w-75";
export const FIELD_GROUP_CLASSES = "col-12 col-lg-5 text-start border border-dark m-1 p-2";
export const FIELD_GROUP_NAME_CLASSES = "text-start fw-bold text-primary mb-4 fs-4";
export const FIELDS_CONTAINER_CLASSES = "col-12 row d-flex justify-content-evenly align-items-start";
export const HAVE_VALUE_CLASS = "text-success";
export const NEW_VALUE_CLASS = "text-warning";

//=============== Modal: active-window state ===============
// Only one modal is open at a time; this module owns that single active-modal state.

let activeModal = null;
let activeKeydownListener = null;

/** Returns the currently open modal overlay (or null), for reading its field values. */
export function getActiveModal()
{
    return activeModal;
}

/** Opens a modal via a factory that builds, appends, and returns its overlay. */
export function openModal(createModal)
{
    if (activeModal) return;
    activeModal = createModal();
}

/** Closes the active modal and detaches its keydown listener. */
export function closeActiveModal()
{
    if (activeModal)
    {
        activeModal.remove();
        activeModal = null;
    }
    if (activeKeydownListener)
    {
        document.removeEventListener('keydown', activeKeydownListener);
        activeKeydownListener = null;
    }
}

/** Enter triggers the given button, Escape closes the modal. */
export function addModalKeydownListener(primaryActionButton)
{
    const handler = (event) =>
    {
        if (event.key === 'Escape') closeActiveModal();
        if (event.key === 'Enter') primaryActionButton.click();
    };
    document.addEventListener('keydown', handler);
    activeKeydownListener = handler;
}

//=============== Modal: shared builders ===============

/** Every modal shares this overlay + centered card + title skeleton. */
export function createModalShell(titleText, { widthClass = 'col-11 col-md-10', titleClass = 'mb-3 text-danger fw-bold fs-1' } = {})
{
    const overlay = document.createElement('div');
    overlay.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75';
    overlay.style.zIndex = '1050';

    const content = document.createElement('div');
    content.className = `${widthClass} bg-dark bg-opacity-75 p-4 rounded shadow-lg text-center`;
    content.style.maxHeight = '90vh';
    content.style.overflowY = 'auto';

    const title = document.createElement('h1');
    title.className = titleClass;
    title.textContent = titleText;
    content.appendChild(title);

    overlay.appendChild(content);
    return { overlay, content };
}

/**
 * Builds a row of buttons. Each button's click runs through withUiLock so modal buttons and
 * page controls share one locking rule.
 * @param {Array<{text:string,className:string,onClick:Function,listenForEnter?:boolean}>} buttons
 * @param {Object} [options]
 * @param {string} [options.containerClass]
 */
export function createButtonRow(buttons, { containerClass = 'col-12 d-flex justify-content-evenly align-items-center' } = {})
{
    const row = document.createElement('div');
    row.className = containerClass;
    buttons.forEach(({ text, className, onClick, listenForEnter }) =>
    {
        const button = document.createElement('button');
        button.className = className;
        button.textContent = text;
        button.addEventListener('click', () => withUiLock(button, onClick));
        if (listenForEnter) addModalKeydownListener(button);
        row.appendChild(button);
    });
    return row;
}

/** Wraps a set of field elements under a named heading (e.g. "Email:" with its filters). */
export function buildFieldGroup(groupTitle, fieldElements)
{
    const group = document.createElement('div');
    group.className = FIELD_GROUP_CLASSES;

    const groupTitleElement = document.createElement('p');
    groupTitleElement.className = FIELD_GROUP_NAME_CLASSES;
    groupTitleElement.textContent = groupTitle + ":";
    group.appendChild(groupTitleElement);

    fieldElements.forEach(fieldElement => group.appendChild(fieldElement));
    return group;
}

//=============== Modal: field builders ===============
// "Edit" fields highlight their label when the live value differs from the target's value.

export function buildEditInputField(target, label, labelText, type)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const labelElement = document.createElement('p');
    labelElement.className = LABEL_CLASSES;
    labelElement.textContent = labelText;
    field.appendChild(labelElement);

    const input = document.createElement('input');
    input.type = type;
    input.id = label;
    input.className = INPUT_CLASSES;

    if (target && target[label] !== undefined)
    {
        if (Array.isArray(target[label]))
        {
            input.value = target[label].join(", ");
        }
        else
        {
            input.value = (type === 'date') ? new Date(target[label]).toISOString().split('T')[0] : target[label];
        }
    }

    input.addEventListener('input', () =>
    {
        let originalFieldValue = target ? target[label] : '';
        if (Array.isArray(originalFieldValue))
        {
            originalFieldValue = originalFieldValue.join(", ");
        }
        else if (type === 'date')
        {
            originalFieldValue = target ? new Date(originalFieldValue).toISOString().split('T')[0] : '';
        }
        const isUnchanged = input.value === '' || (target && input.value === originalFieldValue);
        labelElement.classList.toggle(NEW_VALUE_CLASS, !isUnchanged);
    });

    field.appendChild(input);
    return field;
}

export function buildEditSelectField(target, label, labelText, options)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const labelElement = document.createElement('p');
    labelElement.className = LABEL_CLASSES;
    labelElement.textContent = labelText;
    field.appendChild(labelElement);

    const select = document.createElement('select');
    select.id = label;
    select.className = SELECT_CLASSES;
    options.forEach(option =>
    {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });

    if (target && target[label] && target[label] !== options[0])
    {
        select.value = target[label];
    }

    select.addEventListener('change', () =>
    {
        const isUnchanged = select.value === options[0] || (target && select.value === target[label]);
        labelElement.classList.toggle(NEW_VALUE_CLASS, !isUnchanged);
    });

    field.appendChild(select);
    return field;
}

// "Search" fields just track whether the user has entered a value at all (no original to compare).
export function buildSearchInputField(initialFilters, label, labelText, type)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const labelElement = document.createElement('p');
    labelElement.className = LABEL_CLASSES;
    labelElement.textContent = labelText;
    field.appendChild(labelElement);

    const input = document.createElement('input');
    input.type = type;
    input.id = label;
    input.className = INPUT_CLASSES;

    if (initialFilters && initialFilters[label])
    {
        labelElement.classList.add(HAVE_VALUE_CLASS);
        input.value = initialFilters[label];
    }

    input.addEventListener('input', () =>
    {
        if (input.value === '')
        {
            labelElement.classList.remove(HAVE_VALUE_CLASS, NEW_VALUE_CLASS);
        }
        else
        {
            labelElement.classList.add(NEW_VALUE_CLASS);
        }
    });

    field.appendChild(input);
    return field;
}

export function buildSearchSelectField(initialFilters, label, labelText, options)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const labelElement = document.createElement('p');
    labelElement.className = LABEL_CLASSES;
    labelElement.textContent = labelText;
    field.appendChild(labelElement);

    const select = document.createElement('select');
    select.id = label;
    select.className = SELECT_CLASSES;
    options.forEach(option =>
    {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });

    if (initialFilters && initialFilters[label] && initialFilters[label] !== options[0])
    {
        labelElement.classList.add(HAVE_VALUE_CLASS);
        select.value = initialFilters[label];
    }

    select.addEventListener('change', () =>
    {
        if (select.value === options[0])
        {
            labelElement.classList.remove(HAVE_VALUE_CLASS, NEW_VALUE_CLASS);
        }
        else
        {
            labelElement.classList.add(NEW_VALUE_CLASS);
        }
    });

    field.appendChild(select);
    return field;
}

//=============== Modal: field readers ===============

/** Reads every input/select value from a modal into a plain object keyed by element id. */
export function getFormValuesFromModal(modalElement)
{
    const values = {};
    modalElement.querySelectorAll('input').forEach(input => { values[input.id] = input.value; });
    modalElement.querySelectorAll('select').forEach(select => { values[select.id] = select.value; });
    return values;
}

/** Like getFormValuesFromModal, but skips each select's first option (treated as "no filter"). */
export function getSearchFiltersFromModal(modalElement)
{
    if (!modalElement) return {};
    const filters = {};
    modalElement.querySelectorAll('input').forEach(input => { filters[input.id] = input.value; });
    modalElement.querySelectorAll('select').forEach(select =>
    {
        if (select.selectedIndex === 0) return;
        filters[select.id] = select.value;
    });
    return filters;
}

//=============== Modal: ready-made modals ===============

/** Update-user modal shared by the admin dashboard and the profiles page. */
export function createUpdateUserModal(user, onUpdateUser)
{
    if (!user || !(user instanceof UserInfo))
    {
        showErrorMessage("No user selected");
        return null;
    }

    const { overlay, content } = createModalShell('Update User');

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fieldsContainer);

    // maps to: { email, phone, fullName, birthday } on UserInfo
    fieldsContainer.appendChild(buildEditInputField(user, 'email', "Email", 'text'));
    fieldsContainer.appendChild(buildEditInputField(user, 'phone', "Phone", 'text'));
    fieldsContainer.appendChild(buildEditInputField(user, 'fullName', "Full Name", 'text'));
    fieldsContainer.appendChild(buildEditInputField(user, 'birthday', "Birth Date", 'date'));
    fieldsContainer.appendChild(buildEditInputField(user, 'password', "Set New password", 'password'));

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        { text: 'Update', className: 'btn btn-primary btn-lg', onClick: () => onUpdateUser(user), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

/** Generic confirmation modal with a warning line and a destructive confirm button. */
export function createConfirmationModal(message, onConfirm, confirmText = 'Delete')
{
    const { overlay, content } = createModalShell('Are you sure?', {
        widthClass: 'col-10 col-md-6',
        titleClass: 'mb-3 text-danger fw-bold fs-2'
    });

    const messageElement = document.createElement('p');
    messageElement.className = 'text-white fs-5 mb-4';
    messageElement.textContent = message;
    content.appendChild(messageElement);

    const warningElement = document.createElement('p');
    warningElement.className = 'text-warning fw-bold mb-4';
    warningElement.textContent = 'This action cannot be undone.';
    content.appendChild(warningElement);

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        { text: confirmText, className: 'btn btn-danger btn-lg', onClick: async () => { await onConfirm(); }, listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

//=============== Generic modal helpers ===============

/**
 * Builds a "changed fields only" patch by comparing modal form values with the target entity.
 * Password-type keys count as a change on any non-empty value; date/array fields are
 * normalized before comparison; array fields are split back into trimmed arrays.
 */
export function buildChangedFields(formValues, target, { dateFields = [], arrayFields = [], passwordKeys = ['password'] } = {})
{
    const changes = {};

    for (const key in formValues)
    {
        if (passwordKeys.includes(key))
        {
            if (formValues[key] !== '') changes[key] = formValues[key];
            continue;
        }
        if (!(key in target)) continue;
        if (formValues[key] === '') continue;

        let existingValue;
        if (dateFields.includes(key))
        {
            existingValue = target[key] ? new Date(target[key]).toISOString().split('T')[0] : '';
        }
        else if (Array.isArray(target[key]))
        {
            existingValue = target[key].join(", ");
        }
        else
        {
            existingValue = String(target[key] ?? '');
        }

        if (formValues[key] !== existingValue)
        {
            changes[key] = arrayFields.includes(key)
                ? formValues[key].split(',').map(part => part.trim()).filter(part => part !== '')
                : formValues[key];
        }
    }

    return changes;
}

/** Closes the active modal, then shows an error message. */
export function failInModal(message)
{
    closeActiveModal();
    showErrorMessage(message);
}

/** Closes the active modal, then shows an informative message. */
export function infoInModal(message)
{
    closeActiveModal();
    showMessage(message);
}

/**
 * Confirmation-guarded backend removal used by the admin delete/kick flows.
 * @param {Object} options
 * @param {string} options.message - Confirmation prompt.
 * @param {Function} options.action - Async backend call returning a { success } response.
 * @param {Function} [options.onSuccess] - Runs after a successful action.
 * @param {string} [options.successMessage] - Message shown on success.
 * @param {string} [options.actionLabel] - Label used in the failure log.
 * @param {string} [options.confirmText] - Confirm button text.
 */
export function confirmAndRemove({ message, action, onSuccess, successMessage, actionLabel = 'complete the operation', confirmText = 'Delete' })
{
    openModal(() => createConfirmationModal(message, async () =>
    {
        const response = await action();
        if (!isOk(response, actionLabel))
        {
            failInModal((response && response.message) ? `Operation failed: ${response.message}` : 'Operation failed');
            return;
        }
        closeActiveModal();
        if (successMessage) showMessage(successMessage);
        if (onSuccess) await onSuccess(response);
    }, confirmText));
}

/**
 * Builds a search-filters modal from a grouped field config, wiring Cancel/Search buttons.
 * @param {string} title
 * @param {Array<{groupName:string, fields:Array<{kind?:'input'|'select', id:string, label:string, type?:string, options?:Array<string>}>}>} fieldGroups
 * @param {Function} onSearch - Receives the collected filters object.
 * @param {Object} [initialFilters] - Existing filter values, to prefill.
 */
export function createFiltersModal(title, fieldGroups, onSearch, initialFilters = {})
{
    const { overlay, content } = createModalShell(title);

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fieldsContainer);

    fieldGroups.forEach(group =>
    {
        const fieldElements = group.fields.map(field =>
            field.kind === 'select'
                ? buildSearchSelectField(initialFilters, field.id, field.label, field.options)
                : buildSearchInputField(initialFilters, field.id, field.label, field.type || 'text'));
        fieldsContainer.appendChild(buildFieldGroup(group.groupName, fieldElements));
    });

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        { text: 'Search', className: 'btn btn-primary btn-lg', onClick: () => onSearch(getSearchFiltersFromModal(getActiveModal())), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Builds a generic form modal: a fields container followed by a button row.
 * @param {string} title
 * @param {Array<HTMLElement>} fieldElements
 * @param {Array<Object>} buttons - Passed to createButtonRow.
 * @param {Object} [shellOptions] - Passed to createModalShell.
 */
export function buildFormModal(title, fieldElements, buttons, shellOptions = {})
{
    const { overlay, content } = createModalShell(title, shellOptions);

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = FIELDS_CONTAINER_CLASSES;
    fieldElements.forEach(fieldElement => fieldsContainer.appendChild(fieldElement));
    content.appendChild(fieldsContainer);

    content.appendChild(createButtonRow(buttons));

    document.body.appendChild(overlay);
    return overlay;
}

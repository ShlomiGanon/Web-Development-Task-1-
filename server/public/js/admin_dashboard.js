//i know this code is can be reused for other pages but i dont have time to refactor it , sorry for that.

import { UserInfo, ContentItem, Review } from "./BACKEND_API/backend-interface.js";
import { Backend } from "./config.js";
import {ClientSessionManager} from "./client-session-manager.js";
import * as UI from "./ui-utils.js";
// D3.js is loaded straight from a CDN as an ES module - no extra <script> tag needed in
// the HTML page, and no other charting library is used anywhere in this file.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

//=============== Session / Auth Bootstrap ===============
// Order matters here: each check can redirect away. Unlike the original version, every
// failure now stops the rest of this bootstrap immediately instead of falling through to
// the next line.
//
function redirectToIndex(button_was_pressed = null)
{
    UI.LockUI(button_was_pressed);
    UI.GoToLink("/");
}

async function initAdminSession()
{
    const session_token = ClientSessionManager.getSessionToken();
    if (!session_token)
    {
        redirectToIndex();
        return null;
    }

    const user_response = await Backend.fetchActiveUserInfo(session_token);
    if (!user_response || !user_response.success || !user_response.user)
    {
        redirectToIndex();
        return null;
    }

    const user = user_response.user;
    if (!user.permission_level)
    {
        redirectToIndex();
        return null;
    }

    return { session_token, user };
}

const admin_session = await initAdminSession();
if (!admin_session)
{
    // We're already navigating away (redirectToIndex() above triggered it). Throwing here
    // just stops the rest of this module - everything below assumes a valid token and
    // active_user - from running while that navigation is in flight.
    throw new Error("Not authorized for the admin dashboard - redirecting.");
}

const token = admin_session.session_token;
let active_user = admin_session.user;
let current_target = null;

//=============== Permission Levels ===============
const Permmision_Level =
{
    SUPER_ADMIN: 2,
    ADMIN: 1,
    USER: 0
}
// Reverse lookup (2 -> "SUPER_ADMIN") so the permission dropdown can render
// human-readable labels while still storing/sending the numeric level.
const PermissionLookup = Object.fromEntries(
    Object.entries(Permmision_Level).map(([key, val]) => [val, key])
);

//=============== DOM References ===============
const mode_selector_container = document.getElementById("mode_selector_container");
const controll_container = document.getElementById("controll_container");
const selection_container = document.getElementById("selection_container");
const selection_counter = document.getElementById("selection_counter");
const view_container = document.getElementById("view_container");
const msg_box = document.getElementById("msg_box");

let filters_window = null;
let filters_listener = null;

const mode = Object.freeze({
    "users": 0,
    "contents": 1,
    "reviews": 2
});
// Reverse lookup (1 -> "users") - used by the mode-selector buttons to display names.
const numbers_to_modes = Object.fromEntries(Object.entries(mode).map(([key, value]) => [value, key]));
let current_mode = mode.users;

let users = [];
let contents = [];
let reviews = [];
let users_filters = {};
let contents_filters = {};
let reviews_filters = {};

// Cache of the currently-viewed series' episodes, grouped by season (same shape as
// Backend.getContentEpisodes()'s response: seasons[0] = season 1's episodes, etc.) -
// refreshed every time view_content() renders a series, and after every episode
// add/update/delete so the list stays in sync.
let current_target_episodes = null;

//=============== Shared UI Class Constants ===============
// Used by the modal/field-builder helpers below so every window shares one visual style.
const FIELD_ITEM_CLASSES = "col-12 d-flex justify-content-between align-items-center border border-secondary p-2 m-2";
const LABEL_CLASSES = "text-start fw-bold fs-5 text-secondary";
const INPUT_CLASSES = "form-control w-75";
const SELECT_CLASSES = "form-select w-75";
const FIELD_GROUP_CLASSES = "col-12 col-lg-5 text-start border border-dark m-1 p-2";
const FIELD_GROUP_NAME_CLASSES = "text-start fw-bold text-primary mb-4 fs-4";
const FIELDS_CONTAINER_CLASSES = "col-12 row d-flex justify-content-evenly align-items-start";
const HAVE_VALUE_CLASS = "text-success";
const NEW_VALUE_CLASS = "text-warning";

//=============== Clearing Containers ===============
function clear_selection_container()
{
    selection_container.innerHTML = "";
}
function clear_view_container()
{
    view_container.innerHTML = "";
}
function clear_controll_container()
{
    controll_container.innerHTML = "";
}
function clear_mode_selector_container()
{
    mode_selector_container.innerHTML = "";
}

function switch_mode(new_mode)
{
    current_mode = new_mode;
    main_renderer();
}

function escapeHtml(value)
{
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

//=============== Shared Modal Helpers ===============
// Every popup window (search/update/permission/ban/confirmation) shares this same
// overlay + centered card + title skeleton. Only the inner content differs.
function create_modal_shell(titleText, { widthClass = 'col-10', titleClass = 'mb-3 text-danger fw-bold fs-1' } = {})
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

// buttons: [{ text, className, onClick, listenForEnter? }]
function create_button_row(buttons)
{
    const row = document.createElement('div');
    row.className = 'col-12 d-flex justify-content-evenly align-items-center';
    buttons.forEach(({ text, className, onClick, listenForEnter }) =>
    {
        const btn = document.createElement('button');
        btn.className = className;
        btn.textContent = text;
        btn.addEventListener('click', async () =>
        {
            if (UI.isUILocked) return;
            UI.LockUI(btn);
            try
            {
                await onClick();
            }
            finally
            {
                // Some onClick handlers close the modal (removing `btn` from the DOM)
                // before this resolves - UnlockUI() only touches global UI state, so it's
                // always safe to call even if `btn` itself is already gone.
                UI.UnlockUI();
            }
        });
        if (listenForEnter) add_filters_listener(btn);
        row.appendChild(btn);
    });
    return row;
}

// Wraps a set of field elements under a named heading (e.g. "Email:" with its 3 filters).
function build_field_group(field_name, field_elements)
{
    const group = document.createElement('div');
    group.className = FIELD_GROUP_CLASSES;

    const name_p = document.createElement('p');
    name_p.className = FIELD_GROUP_NAME_CLASSES;
    name_p.textContent = field_name + ":";
    group.appendChild(name_p);

    field_elements.forEach(el => group.appendChild(el));
    return group;
}

//=============== Shared Field Builders ===============
// "Edit" fields (used by Update User / Update+Add Content / Add+Update Episode windows)
// compare their live value against the target object's current value, highlighting the
// label when changed. `target` may be null (create mode) - handled the same way an empty
// original value would be.
//
// NOTE on the comparison logic below: dates and arrays need to be normalized to the same
// string shape on both sides (input.value vs. the stored value) before they can be
// compared with ===, otherwise e.g. a Date object vs. an ISO date string would always
// look "changed" even when nothing was actually edited.
function build_edit_input_field(target, label, text, type)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const label_p = document.createElement('p');
    label_p.className = LABEL_CLASSES;
    label_p.textContent = text;
    field.appendChild(label_p);

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
        let original_value = target ? target[label] : '';
        if (Array.isArray(original_value))
        {
            original_value = original_value.join(", ");
        }
        else if (type === 'date')
        {
            original_value = target ? new Date(original_value).toISOString().split('T')[0] : '';
        }
        const unchanged = input.value === '' || (target && input.value === original_value);
        label_p.classList.toggle(NEW_VALUE_CLASS, !unchanged);
    });

    field.appendChild(input);
    return field;
}

function build_edit_select_field(target, label, text, options)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const label_p = document.createElement('p');
    label_p.className = LABEL_CLASSES;
    label_p.textContent = text;
    field.appendChild(label_p);

    const select = document.createElement('select');
    select.id = label;
    select.className = SELECT_CLASSES;
    options.forEach(option =>
    {
        const option_element = document.createElement('option');
        option_element.value = option;
        option_element.textContent = option;
        select.appendChild(option_element);
    });

    if (target && target[label] && target[label] !== options[0])
    {
        select.value = target[label];
    }

    select.addEventListener('change', () =>
    {
        const unchanged = select.value === options[0] || (target && select.value === target[label]);
        label_p.classList.toggle(NEW_VALUE_CLASS, !unchanged);
    });

    field.appendChild(select);
    return field;
}

// "Search" fields (used by the Users/Contents/Reviews filter windows) just track whether
// the user has typed/selected a value at all - there's no "original" object to compare to.
function build_search_input_field(filters, label, text, type)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const label_p = document.createElement('p');
    label_p.className = LABEL_CLASSES;
    label_p.textContent = text;
    field.appendChild(label_p);

    const input = document.createElement('input');
    input.type = type;
    input.id = label;
    input.className = INPUT_CLASSES;

    if (filters && filters[label])
    {
        label_p.classList.add(HAVE_VALUE_CLASS);
        input.value = filters[label];
    }

    input.addEventListener('input', () =>
    {
        if (input.value === '')
        {
            label_p.classList.remove(HAVE_VALUE_CLASS, NEW_VALUE_CLASS);
        }
        else
        {
            label_p.classList.add(NEW_VALUE_CLASS);
        }
    });

    field.appendChild(input);
    return field;
}

function build_search_select_field(filters, label, text, options)
{
    const field = document.createElement('div');
    field.className = FIELD_ITEM_CLASSES;

    const label_p = document.createElement('p');
    label_p.className = LABEL_CLASSES;
    label_p.textContent = text;
    field.appendChild(label_p);

    const select = document.createElement('select');
    select.id = label;
    select.className = SELECT_CLASSES;
    options.forEach(option =>
    {
        const option_element = document.createElement('option');
        option_element.value = option;
        option_element.textContent = option;
        select.appendChild(option_element);
    });

    if (filters && filters[label] && filters[label] !== options[0])
    {
        label_p.classList.add(HAVE_VALUE_CLASS);
        select.value = filters[label];
    }

    select.addEventListener('change', () =>
    {
        if (select.value === options[0])
        {
            label_p.classList.remove(HAVE_VALUE_CLASS, NEW_VALUE_CLASS);
        }
        else
        {
            label_p.classList.add(NEW_VALUE_CLASS);
        }
    });

    field.appendChild(select);
    return field;
}

//=============== Detail View Renderers ===============
async function view_content()
{
    if (!current_target || !(current_target instanceof ContentItem))
    {
        view_container.innerHTML = `
        <h1>No content selected</h1>
        <p>Please select a content from the list</p>
        `;
        return;
    }

    // Re-fetch by ID instead of trusting the cached list item, since this call
    // also brings back extra fields (like imdb_rating) that the list view doesn't have.
    const response = await Backend.getContentByID(current_target.id);
    if (!response.success || !response.content)
    {
        view_container.innerHTML = `
        <h1>Failed to get content</h1>
        <p>Please try again</p>
        <p>${escapeHtml(response.message)}</p>
        `;
        console.log(response);
        return;
    }
    current_target = response.content;
    console.log(response);

    const image_element = document.createElement('img');
    image_element.src = `/assets/covers/${escapeHtml(current_target.cover_image_name)}`;
    image_element.className = 'img-fluid';
    image_element.style.width = '300px';
    image_element.style.height = '450px';
    image_element.style.objectFit = 'contain';

    // NOTE: videoUrl no longer lives on content - every watchable item is an Episode now
    // (see the Episode Management section rendered below), so it's not shown here.
    // average_rating/review_count are new fields the backend now includes on every
    // content object, kept in sync automatically whenever a review is added/edited/deleted.
    const contentHtml = `
    <div class="w-100 p-4">
        <h1 class="fw-bold mb-4">${escapeHtml(current_target.title)}</h1>
        ${image_element.outerHTML}
        ${renderField("ID", escapeHtml(current_target.id))}
        ${renderField("Cover Image Name", escapeHtml(current_target.cover_image_name))}
        ${renderField("Likes", escapeHtml(current_target.likes))}
        ${renderField("Type", escapeHtml(current_target.type))}
        ${renderField("Categories", escapeHtml(current_target.categories.join(", ")))}
        ${renderField("Description", escapeHtml(current_target.description))}
        ${renderField("Age Limit", escapeHtml(current_target.age_limit))}
        ${renderField("Average Rating", escapeHtml(current_target.average_rating))}
        ${renderField("Review Count", escapeHtml(current_target.review_count))}
        ${renderField("Release Date", escapeHtml(current_target.release_date.toLocaleDateString()))}
        ${renderField("Created At", escapeHtml(current_target.createdAt.toLocaleDateString()))}
        ${renderField("IMDB Rating", escapeHtml(current_target.imdb_rating))}
    </div>
    `;
    view_container.innerHTML = contentHtml;
    await render_episodes_section(current_target);
    rander_mode_selector();
}

async function view_user()
{
    if (!current_target || !(current_target instanceof UserInfo))
    {
        view_container.innerHTML = `
        <h1>No user selected</h1>
        <p>Please select a user from the list</p>
        `;
        return;
    }

    // Ban status and active-session count aren't part of the UserInfo object itself -
    // they're separate admin-only lookups, fetched fresh every time this user is viewed.
    const [ban_response, tokens_response] = await Promise.all([
        Backend.isUserBanned(token, current_target.id),
        Backend.getUserTokensCount(token, current_target.id)
    ]);

    const is_banned = ban_response.success ? ban_response.is_banned : undefined;
    const ban_status_text = ban_response.success
        ? (is_banned ? "Banned" : "Not banned")
        : "Unknown (failed to load)";
    const ban_value_class = is_banned ? "text-danger fw-bold" : "text-white";

    const tokens_count_text = tokens_response.success
        ? String(tokens_response.tokens_count)
        : "Unknown (failed to load)";

    const userHtml = `
    <div class="w-100 p-4">
        <h1 class="fw-bold mb-4">${escapeHtml(current_target.fullName)}</h1>
        ${renderField("ID", escapeHtml(current_target.id))}
        ${renderField("Email", escapeHtml(current_target.email))}
        ${renderField("Phone", escapeHtml(current_target.phone))}
        ${renderField("Birthday", escapeHtml(current_target.birthday.toLocaleDateString()))}
        ${renderField("Created At", escapeHtml(current_target.createdAt.toLocaleDateString()))}
        ${renderField("Permission Level", escapeHtml(current_target.permission_level))}
        ${renderField("Ban Status", escapeHtml(ban_status_text), ':', 'text-danger', ban_value_class)}
        ${renderField("Active Sessions", escapeHtml(tokens_count_text))}
    </div>
    `;
    view_container.innerHTML = userHtml;
    rander_mode_selector();
}

function view_review()
{
    if (!current_target || !(current_target instanceof Review))
    {
        view_container.innerHTML = `
        <h1>No review selected</h1>
        <p>Please select a review from the list</p>
        `;
        return;
    }

    const reviewHtml = `
    <div class="w-100 p-4">
        <h1 class="fw-bold mb-4">Review - ${escapeHtml(current_target.rating)}/10</h1>
        ${renderField("ID", escapeHtml(current_target.id))}
        ${renderField("Content ID", escapeHtml(current_target.contentId))}
        ${renderField("Episode ID", escapeHtml(current_target.episodeId))}
        ${renderField("Profile ID", escapeHtml(current_target.profileId))}
        ${renderField("Rating", escapeHtml(current_target.rating))}
        ${renderField("Comment", escapeHtml(current_target.comment))}
    </div>
    `;
    view_container.innerHTML = reviewHtml;
    rander_mode_selector();
}

function renderField(label, value, seperator = ':', labelClass = 'text-danger', valueClass = 'text-white')
{
    return `
    <div class="label_item border border-white rounded-pill p-2 w-100 m-2" dir="ltr"
         style="display: grid; grid-template-columns: 5fr 1fr 6fr; align-items: center; column-gap: 0.5rem;">
        <div class="text-center ${labelClass} fw-bold fs-4" style="overflow-wrap: break-word; word-break: break-word;">${label}</div>
        <div class="text-center text-warning fw-bold fs-4">${seperator}</div>
        <div class="text-center ${valueClass} fs-5" style="overflow-wrap: break-word; word-break: break-word;">${value}</div>
    </div>
`;
}

function render_controll_container(buttons)
{
    let buttons_html = document.createElement('div');
    buttons_html.className = "d-flex justify-content-evenly align-items-center w-100";
    buttons.forEach(button =>
    {
        const btn = document.createElement("button");
        const btn_type = (button.primary) ? "btn-primary" : "btn-secondary";
        btn.className = `btn btn-group btn-lg ${btn_type} rounded-pill mx-2`;
        btn.textContent = button.name;
        btn.addEventListener("click", button.function);
        buttons_html.appendChild(btn);
    });
    controll_container.replaceChildren(buttons_html);
}

function rander_mode_selector()
{
    clear_mode_selector_container();

    // "last_mode" highlights which tab the currently-viewed item belongs to,
    // independent of which tab is actually active (current_mode). E.g. clicking
    // "My User" while in Contents mode should still show the Users tab as highlighted.
    let last_mode;
    if (current_target instanceof UserInfo) last_mode = mode.users;
    else if (current_target instanceof ContentItem) last_mode = mode.contents;
    else if (current_target instanceof Review) last_mode = mode.reviews;
    else last_mode = undefined;
    const back_button = document.createElement("button");
    back_button.className = "btn btn-group btn-lg btn-outline-light rounded-pill";
    back_button.textContent = "Back to profiles";
    back_button.addEventListener("click", () => 
    {
        if (UI.isUILocked) return;
        UI.LockUI(back_button);
        UI.ShowMessage("Redirecting to profiles...");
        setTimeout(() =>
        {
            UI.GoToLink("/html/profiles.html");
        }, 2000);
    }
    );
    mode_selector_container.appendChild(back_button);
    Object.entries(mode).forEach(([key, value]) =>
    {
        const btn = document.createElement("button");
        btn.className = "btn btn-group btn-lg btn-outline-light rounded-pill";
        if (value === current_mode) btn.classList.add("active");
        if (value === last_mode) btn.classList.add("text-warning");
        btn.textContent = key.toUpperCase() + " Mode";
        btn.addEventListener("click", () => switch_mode(value));
        mode_selector_container.appendChild(btn);
    });
}

//=============== Selection List Renderers ===============
// Shared by all three resources: a clickable card with a title + secondary line.
function build_selection_item(id, title, secondary_title, onClick)
{
    const title_container = document.createElement("div");
    const secondary_container = document.createElement("div");
    title_container.className = "w-100";
    secondary_container.className = "w-100";

    const title_el = document.createElement("h3");
    title_el.className = "text-danger fw-bold text-center";
    title_el.textContent = title;
    title_container.appendChild(title_el);

    const secondary_el = document.createElement("p");
    secondary_el.className = "text-light text-center";
    secondary_el.textContent = secondary_title;
    secondary_container.appendChild(secondary_el);

    const item = document.createElement("button");
    item.className = "btn border border-secondary btn-lg btn-outline-dark m-2";
    item.appendChild(title_container);
    item.appendChild(secondary_container);
    item.addEventListener("click", () => onClick(id));
    return item;
}

function show_empty_selection_message(text)
{
    const title = document.createElement("h3");
    title.className = "text-dark fw-bold text-center";
    title.textContent = text;
    selection_container.replaceChildren(title);
}

function rander_selection_container_to_users()
{
    selection_counter.textContent = `Users Counter: ${users.length}`;
    clear_selection_container();
    if (!users || users.length === 0)
    {
        show_empty_selection_message("No Users Found");
        return;
    }

    const sorted_by = users_filters.sort || "createdAt";
    // Date-valued sort fields need .toLocaleDateString() instead of being shown raw.
    const sorted_by_type = (sorted_by === "createdAt" || sorted_by === "birthday") ? "date" : "text";
    const on_click = (id) => { current_target = users.find(u => u.id === id); view_user(); };

    users.forEach(user =>
    {
        const secondary_value = sorted_by_type === "date" ? user[sorted_by].toLocaleDateString() : user[sorted_by];
        selection_container.appendChild(build_selection_item(user.id, user.fullName, secondary_value, on_click));
    });
}

function rander_selection_container_to_contents()
{
    selection_counter.textContent = `Contents Counter: ${contents.length}`;
    clear_selection_container();
    if (!contents || contents.length === 0)
    {
        show_empty_selection_message("No Contents Found");
        return;
    }

    const sorted_by = contents_filters.sort || "createdAt";
    const date_fields = ["createdAt", "release_date"];
    const sorted_by_type = date_fields.includes(sorted_by) ? "date" : "text";
    const on_click = (id) => { current_target = contents.find(c => c.id === id); view_content(); };

    contents.forEach(content =>
    {
        const secondary_value = sorted_by_type === "date" ? content[sorted_by].toLocaleDateString() : content[sorted_by];
        selection_container.appendChild(build_selection_item(content.id, content.title, secondary_value, on_click));
    });
}

function rander_selection_container_to_reviews()
{
    selection_counter.textContent = `Reviews Counter: ${reviews.length}`;
    clear_selection_container();
    if (!reviews || reviews.length === 0)
    {
        show_empty_selection_message("No Reviews Found");
        return;
    }

    const on_click = (id) => { current_target = reviews.find(r => r.id === id); view_review(); };

    reviews.forEach(review =>
    {
        const secondary_value = review.comment ? review.comment : "(no comment)";
        selection_container.appendChild(build_selection_item(review.id, `Rating: ${review.rating}/10`, secondary_value, on_click));
    });
}

//=============== Filter / Search Handling ===============
async function search_users_filters()
{
    users_filters = get_search_filters_from_window(filters_window);
    const response = await Backend.searchUsers(token, users_filters);
    if (!response.success)
    {
        UI.ShowErrorMessage(response.message);
        return;
    }
    users = response.users;
    main_renderer();
    close_filters_window();
}

async function search_contents_filters()
{
    contents_filters = get_search_filters_from_window(filters_window);
    const response = await Backend.getAllContentItems(contents_filters);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage(response.message);
        return;
    }
    if (!response.content)
    {
        close_filters_window();
        UI.ShowErrorMessage("Failed to load content, please try again.");
        return;
    }
    contents = response.content;
    main_renderer();
    close_filters_window();
}

// Reviews search is a public route (no admin token required), same as content search above.
async function search_reviews_filters()
{
    reviews_filters = get_search_filters_from_window(filters_window);
    const response = await Backend.searchReviews(reviews_filters);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage(response.message);
        return;
    }
    if (!response.reviews)
    {
        close_filters_window();
        UI.ShowErrorMessage("Failed to load reviews, please try again.");
        return;
    }
    reviews = response.reviews;
    main_renderer();
    close_filters_window();
}

// Used by Update/Create windows: reads every input/select in the modal as-is,
// with no special-casing - the caller (update_user/update_content/update_review) does
// the "did this actually change" comparison against the original object itself.
function get_filters_from_window(filters_window)
{
    const filters = {};
    filters_window.querySelectorAll('input').forEach(input => { filters[input.id] = input.value; });
    filters_window.querySelectorAll('select').forEach(select => { filters[select.id] = select.value; });
    return filters;
}

// Used by Search windows: differs from get_filters_from_window() above in one
// important way - for <select> elements, the first option is treated as a
// "no filter" placeholder and is skipped entirely, so it never gets sent as a
// query param (e.g. sortOrder's first option shouldn't force a sort direction).
function get_search_filters_from_window(filters_window)
{
    if (!filters_window) return {};
    const filters = {};
    filters_window.querySelectorAll('input').forEach(input => { filters[input.id] = input.value; });
    filters_window.querySelectorAll('select').forEach(select =>
    {
        if (select.selectedIndex === 0) return; // first option = "no filter" placeholder
        filters[select.id] = select.value;
    });
    return filters;
}

function close_filters_window()
{
    if (filters_window)
    {
        filters_window.remove();
        filters_window = null;
    }
    if (filters_listener)
    {
        document.removeEventListener('keydown', filters_listener);
        filters_listener = null;
    }
}

function open_window(create_fn)
{
    if (filters_window) return;
    filters_window = create_fn();
}

function add_filters_listener(enter_like_press_button)
{
    const handler = (event) =>
    {
        if (event.key === 'Escape') close_filters_window();
        if (event.key === 'Enter') enter_like_press_button.click();
    };
    document.addEventListener('keydown', handler);
    filters_listener = handler;
}

//=============== User: Update Window ===============
function create_update_user_window(user , primary_button_func = null)
{
    if (!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return null;
    }

    const { overlay, content } = create_modal_shell('Update User');

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);

    // maps to: { email, phone, fullName, birthday } on UserInfo
    fields_container.appendChild(build_edit_input_field(user, 'email', "Email", 'text'));
    fields_container.appendChild(build_edit_input_field(user, 'phone', "Phone", 'text'));
    fields_container.appendChild(build_edit_input_field(user, 'fullName', "Full Name", 'text'));
    fields_container.appendChild(build_edit_input_field(user, 'birthday', "Birth Date", 'date'));
    fields_container.appendChild(build_edit_input_field(user, 'password', "Set New password", 'password'));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        { text: 'Update', className: 'btn btn-primary btn-lg', onClick: () => primary_button_func ? primary_button_func(user) : update_user(user), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function update_user(user)
{
    const form_data = get_filters_from_window(filters_window);
    let changes = {};
    const date_fields = ['birthday'];

    // Build a minimal "changes" object: only fields the admin actually typed into
    // AND that differ from the user's current value get sent to the backend.
    for (const key in form_data)
    {
        // 'password' is never present on the `user` object returned from the server (it's
        // never sent back for security reasons), so the generic `!(key in user)` check
        // below would always skip it - meaning a newly typed password was silently
        // dropped and never sent to the backend. Handle it separately: any non-empty
        // value is treated as a change.
        if (key === 'password')
        {
            if (form_data[key] !== "") changes[key] = form_data[key];
            continue;
        }
        if (!(key in user)) continue;
        if (form_data[key] === "") continue; // empty input means "no change"

        let original_value;
        if (date_fields.includes(key))
        {
            original_value = user[key] ? new Date(user[key]).toISOString().split('T')[0] : '';
        }
        else
        {
            original_value = String(user[key] ?? '');
        }

        if (form_data[key] !== original_value)
        {
            changes[key] = form_data[key];
        }
    }

    if (Object.keys(changes).length === 0)
    {
        close_filters_window();
        UI.ShowMessage("No changes to update");
        return;
    }

    const response = await Backend.updateUserById(token, user.id, changes);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage("Update failed, server error: " + response.message);
        return;
    }
    if (!response.user)
    {
        close_filters_window();
        UI.ShowErrorMessage("User update failed - invalid response from server.");
        return;
    }

    UI.ShowMessage("User updated successfully");
    current_target = response.user;
    view_user();
    close_filters_window();
}

//=============== Content: Add / Update Window ===============
async function create_content()
{
    const form_data = get_filters_from_window(filters_window);
    const array_fields = ['categories'];
    const contentData = {};

    for (const key in form_data)
    {
        if (form_data[key] === '') continue;
        // Array fields arrive from the form as a comma-separated string
        // (e.g. "action, comedy") and need to be split back into a real array.
        contentData[key] = array_fields.includes(key)
            ? form_data[key].split(',').map(v => v.trim()).filter(v => v !== '')
            : form_data[key];
    }

    // Required fields per the backend schema: title, type, release_date
    if (!contentData.title || !contentData.type || !contentData.release_date)
    {
        close_filters_window();
        UI.ShowErrorMessage("Title, type and release date are required");
        return;
    }

    const response = await Backend.createContent(token, contentData);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage("Creation failed, server error: " + response.message);
        return;
    }
    if (!response.content)
    {
        close_filters_window();
        UI.ShowErrorMessage("Content creation failed - invalid response from server.");
        return;
    }

    UI.ShowMessage("Content created successfully");
    contents.push(response.content);
    current_target = response.content;
    view_content();
    close_filters_window();
}

// contentItem = null -> "Add Content" mode; otherwise "Update Content" mode.
// NOTE: there is deliberately no "Video URL" field here - video lives only on Episodes now,
// never on content itself. Use the "Episodes" section in the content detail view (or the
// "Set Movie Video" control for movies) to manage playback video. average_rating/review_count
// are also deliberately not editable here - they're read-only, server-computed fields kept
// in sync via the review endpoints.
function create_update_content_window(contentItem = null)
{
    const is_create_mode = !contentItem;
    if (!is_create_mode && !(contentItem instanceof ContentItem))
    {
        UI.ShowErrorMessage("no content selected");
        return null;
    }

    const { overlay, content } = create_modal_shell(is_create_mode ? 'Add Content' : 'Update Content');

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);

    // maps to: { title, description, cover_image_name, type, categories, release_date, age_limit } on ContentItem
    fields_container.appendChild(build_edit_input_field(contentItem, 'title', "Title", 'text'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'description', "Description", 'text'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'cover_image_name', "Cover Image Name", 'text'));
    fields_container.appendChild(build_edit_select_field(contentItem, 'type', "Type", ['movie', 'series']));
    fields_container.appendChild(build_edit_input_field(contentItem, 'categories', "Categories", 'text'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'release_date', "Release Date", 'date'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'age_limit', "Age Limit", 'number'));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        {
            text: is_create_mode ? 'Create' : 'Update',
            className: 'btn btn-primary btn-lg',
            onClick: () => { is_create_mode ? create_content() : update_content(contentItem); },
            listenForEnter: true
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function update_content(content)
{
    const form_data = get_filters_from_window(filters_window);
    let changes = {};
    const date_fields = ['release_date'];
    const array_fields = ['categories'];

    // Same "only send what actually changed" pattern as update_user() above,
    // but also has to normalize array fields (categories) for the comparison.
    for (const key in form_data)
    {
        if (!(key in content)) continue;
        if (form_data[key] === "") continue;

        let original_value;
        if (date_fields.includes(key))
        {
            original_value = content[key] ? new Date(content[key]).toISOString().split('T')[0] : '';
        }
        else if (Array.isArray(content[key]))
        {
            original_value = content[key].join(", ");
        }
        else
        {
            original_value = String(content[key] ?? '');
        }

        if (form_data[key] !== original_value)
        {
            changes[key] = array_fields.includes(key)
                ? form_data[key].split(',').map(v => v.trim()).filter(v => v !== '')
                : form_data[key];
        }
    }

    if (Object.keys(changes).length === 0)
    {
        close_filters_window();
        UI.ShowMessage("No changes to update");
        return;
    }

    const response = await Backend.updateContent(token, content.id, changes);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage("Update failed, server error: " + response.message);
        return;
    }
    if (!response.content)
    {
        close_filters_window();
        UI.ShowErrorMessage("Content update failed - invalid response from server.");
        return;
    }

    UI.ShowMessage("Content updated successfully");
    current_target = response.content;
    view_content();
    close_filters_window();
}

//=============== Episode Management ===============
// Renders either the series' full episode list (grouped by season, with add/edit/delete
// controls) or, for a movie, a small "set/update video" control - appended below the
// content details rendered by view_content() above.
async function render_episodes_section(content)
{
    const container = document.createElement('div');
    container.className = 'w-100 p-4';

    if (content.type === 'series')
    {
        const response = await Backend.getContentEpisodes(content.id);
        if (!response.success)
        {
            const error_p = document.createElement('p');
            error_p.className = 'text-danger fs-5';
            error_p.textContent = 'Failed to load episodes: ' + response.message;
            container.appendChild(error_p);
            view_container.appendChild(container);
            return;
        }

        current_target_episodes = response.seasons ?? [];

        const heading = document.createElement('h2');
        heading.className = 'fw-bold mb-3 text-danger';
        heading.textContent = 'Episodes';
        container.appendChild(heading);

        const add_episode_btn = document.createElement('button');
        add_episode_btn.className = 'btn btn-primary btn-lg mb-3';
        add_episode_btn.textContent = 'Add Episode';
        add_episode_btn.addEventListener('click', () => open_window(() => create_episode_window(content.id)));
        container.appendChild(add_episode_btn);

        if (current_target_episodes.length === 0)
        {
            const empty_p = document.createElement('p');
            empty_p.className = 'text-light fs-5';
            empty_p.textContent = 'No episodes yet';
            container.appendChild(empty_p);
        }

        current_target_episodes.forEach((season_episodes, season_index) =>
        {
            const season_number = season_index + 1;

            const season_heading = document.createElement('h4');
            season_heading.className = 'text-warning mt-3';
            season_heading.textContent = `Season ${season_number}`;
            container.appendChild(season_heading);

            if (season_episodes.length === 0)
            {
                const empty_season_p = document.createElement('p');
                empty_season_p.className = 'text-light';
                empty_season_p.textContent = 'No episodes in this season';
                container.appendChild(empty_season_p);
                return;
            }

            season_episodes.forEach(episode =>
            {
                const row = document.createElement('div');
                row.className = FIELD_ITEM_CLASSES;

                const label_p = document.createElement('p');
                label_p.className = LABEL_CLASSES;
                label_p.textContent = `E${episode.episodeNumber} - ${episode.title || '(no title)'}`;
                row.appendChild(label_p);

                const btn_row = document.createElement('div');
                btn_row.className = 'd-flex';

                const edit_btn = document.createElement('button');
                edit_btn.className = 'btn btn-secondary mx-1';
                edit_btn.textContent = 'Edit';
                edit_btn.addEventListener('click', () => open_window(() => create_episode_window(content.id, episode)));
                btn_row.appendChild(edit_btn);

                const delete_btn = document.createElement('button');
                delete_btn.className = 'btn btn-danger mx-1';
                delete_btn.textContent = 'Delete';
                delete_btn.addEventListener('click', () => delete_episode_click(content.id, episode));
                btn_row.appendChild(delete_btn);

                row.appendChild(btn_row);
                container.appendChild(row);
            });
        });
    }
    else if (content.type === 'movie')
    {
        current_target_episodes = null; // not relevant for movies

        const heading = document.createElement('h2');
        heading.className = 'fw-bold mb-3 text-danger';
        heading.textContent = 'Movie Video';
        container.appendChild(heading);

        // NOTE: there's no endpoint to fetch a movie's current video URL (the only way to
        // read an episode is by its id, and movies don't expose theirs directly) - so this
        // can only set/replace it, not display what's currently set.
        const note_p = document.createElement('p');
        note_p.className = 'text-light';
        note_p.textContent = "There's no way to look up this movie's current video URL - enter a new one below to set or replace it.";
        container.appendChild(note_p);

        const input_row = document.createElement('div');
        input_row.className = FIELD_ITEM_CLASSES;

        const label_p = document.createElement('p');
        label_p.className = LABEL_CLASSES;
        label_p.textContent = 'Video URL';
        input_row.appendChild(label_p);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'movie_video_url';
        input.className = INPUT_CLASSES;
        input_row.appendChild(input);
        container.appendChild(input_row);

        const set_btn = document.createElement('button');
        set_btn.className = 'btn btn-primary btn-lg mt-2';
        set_btn.textContent = 'Set Movie Video';
        set_btn.addEventListener('click', async () =>
        {
            if (UI.isUILocked) return;
            UI.LockUI(set_btn);
            try
            {
                await set_movie_video_click(content.id, input);
            }
            finally
            {
                UI.UnlockUI();
            }
        });
        container.appendChild(set_btn);
    }

    view_container.appendChild(container);
}

async function set_movie_video_click(contentId, input)
{
    const videoUrl = input.value.trim();
    if (!videoUrl)
    {
        UI.ShowErrorMessage('Please enter a video URL');
        return;
    }

    const response = await Backend.setMovieVideo(token, contentId, videoUrl);
    if (!response.success)
    {
        UI.ShowErrorMessage('Failed to set movie video: ' + response.message);
        return;
    }

    UI.ShowMessage('Movie video set successfully');
    input.value = '';
}

// episode = null -> "Add Episode" mode; otherwise "Update Episode" mode.
// Field ids intentionally match the Episode class's own property names (seasonNumber,
// episodeNumber, title, videoUrl) so build_edit_input_field's prefill/change-highlight
// logic (which reads target[label] directly) works against the raw Episode object - they
// get mapped to the API's season_number/episode_number body keys in the submit handlers.
function create_episode_window(contentId, episode = null)
{
    const is_create_mode = !episode;
    const { overlay, content } = create_modal_shell(is_create_mode ? 'Add Episode' : 'Update Episode');

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);

    fields_container.appendChild(build_edit_input_field(episode, 'seasonNumber', "Season Number", 'number'));
    fields_container.appendChild(build_edit_input_field(episode, 'episodeNumber', "Episode Number", 'number'));
    fields_container.appendChild(build_edit_input_field(episode, 'title', "Title", 'text'));
    fields_container.appendChild(build_edit_input_field(episode, 'videoUrl', "Video URL", 'text'));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        {
            text: is_create_mode ? 'Create' : 'Update',
            className: 'btn btn-primary btn-lg',
            onClick: () => { is_create_mode ? create_episode(contentId) : update_episode(contentId, episode); },
            listenForEnter: true
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function create_episode(contentId)
{
    const form_data = get_filters_from_window(filters_window);

    if (form_data.seasonNumber === '' || form_data.episodeNumber === '')
    {
        close_filters_window();
        UI.ShowErrorMessage('Season number and episode number are required');
        return;
    }

    const episodeData = {
        season_number: Number(form_data.seasonNumber),
        episode_number: Number(form_data.episodeNumber)
    };
    if (form_data.title !== '') episodeData.title = form_data.title;
    if (form_data.videoUrl !== '') episodeData.videoUrl = form_data.videoUrl;

    const response = await Backend.addEpisode(token, contentId, episodeData);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage('Failed to add episode: ' + response.message);
        return;
    }

    UI.ShowMessage('Episode added successfully');
    close_filters_window();
    await view_content(); // refreshes the episodes list too
}

async function update_episode(contentId, episode)
{
    const form_data = get_filters_from_window(filters_window);
    // Maps the field ids (matching Episode's own camelCase properties) to the snake_case
    // body keys the update endpoint expects.
    const key_map = { seasonNumber: 'season_number', episodeNumber: 'episode_number', title: 'title', videoUrl: 'videoUrl' };
    const changes = {};

    for (const form_key in key_map)
    {
        if (form_data[form_key] === "") continue;

        const original_value = String(episode[form_key] ?? '');
        if (form_data[form_key] !== original_value)
        {
            const body_key = key_map[form_key];
            changes[body_key] = (form_key === 'seasonNumber' || form_key === 'episodeNumber')
                ? Number(form_data[form_key])
                : form_data[form_key];
        }
    }

    if (Object.keys(changes).length === 0)
    {
        close_filters_window();
        UI.ShowMessage('No changes to update');
        return;
    }

    const response = await Backend.updateEpisode(token, contentId, episode.id, changes);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage('Failed to update episode: ' + response.message);
        return;
    }

    UI.ShowMessage('Episode updated successfully');
    close_filters_window();
    await view_content();
}

function delete_episode_click(contentId, episode)
{
    open_window(() => create_confirmation_window(
        `Are you sure you want to delete episode "S${episode.seasonNumber}E${episode.episodeNumber}"?`,
        async () =>
        {
            const response = await Backend.deleteEpisode(token, contentId, episode.id);
            if (!response.success)
            {
                close_filters_window();
                UI.ShowErrorMessage('Failed to delete episode: ' + response.message);
                return;
            }

            UI.ShowMessage('Episode deleted successfully');
            close_filters_window();
            await view_content();
        }
    ));
}

//=============== Review: Update Window ===============
// Only rating and comment are editable - id/contentId/episodeId/profileId are fixed
// once a review is created (there's no route to change what it points to).
function create_update_review_window(reviewItem)
{
    if (!reviewItem || !(reviewItem instanceof Review))
    {
        UI.ShowErrorMessage("No review selected");
        return null;
    }

    const { overlay, content } = create_modal_shell('Update Review');

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);

    // maps to: { rating, comment } on Review
    fields_container.appendChild(build_edit_input_field(reviewItem, 'rating', "Rating (1-10)", 'number'));
    fields_container.appendChild(build_edit_input_field(reviewItem, 'comment', "Comment", 'text'));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        { text: 'Update', className: 'btn btn-primary btn-lg', onClick: () => update_review(reviewItem), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function update_review(review)
{
    const form_data = get_filters_from_window(filters_window);
    let changes = {};

    // Same "only send what actually changed" pattern as update_user()/update_content() above.
    for (const key in form_data)
    {
        if (!(key in review)) continue;
        if (form_data[key] === "") continue;

        const original_value = String(review[key] ?? '');
        if (form_data[key] !== original_value)
        {
            changes[key] = (key === 'rating') ? Number(form_data[key]) : form_data[key];
        }
    }

    if (Object.keys(changes).length === 0)
    {
        close_filters_window();
        UI.ShowMessage("No changes to update");
        return;
    }

    const response = await Backend.adminUpdateReview(token, review.id, changes);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage("Update failed, server error: " + response.message);
        return;
    }
    if (!response.review)
    {
        close_filters_window();
        UI.ShowErrorMessage("Review update failed - invalid response from server.");
        return;
    }

    UI.ShowMessage("Review updated successfully");
    current_target = response.review;
    view_review();
    close_filters_window();
}

//=============== Users: Search Filters Window ===============
function create_users_filters_window(filters)
{
    const { overlay, content } = create_modal_shell('Users filters Setup');

    const fullname_filters = [
        build_search_input_field(filters, 'fullname_starts', 'Starts with', 'text'),
        build_search_input_field(filters, 'fullname_ends', 'Ends with', 'text'),
        build_search_input_field(filters, 'fullname_contains', 'Contains', 'text'),
    ];
    const email_filters = [
        build_search_input_field(filters, 'email_starts', 'Starts with', 'text'),
        build_search_input_field(filters, 'email_ends', 'Ends with', 'text'),
        build_search_input_field(filters, 'email_contains', 'Contains', 'text'),
    ];
    const phone_filters = [
        build_search_input_field(filters, 'phone_starts', 'Starts with', 'text'),
        build_search_input_field(filters, 'phone_ends', 'Ends with', 'text'),
        build_search_input_field(filters, 'phone_contains', 'Contains', 'text'),
    ];
    const birth_date_filters = [
        build_search_input_field(filters, 'born_after', 'After', 'date'),
        build_search_input_field(filters, 'born_before', 'Before', 'date'),
    ];
    const join_date_filters = [
        build_search_input_field(filters, 'joined_after', 'After', 'date'),
        build_search_input_field(filters, 'joined_before', 'Before', 'date'),
    ];
    const sort_filters = [
        build_search_select_field(filters, 'sort', 'Sort', ['createdAt', 'birthday', 'fullName', 'email']),
        build_search_select_field(filters, 'sortOrder', 'Sort Order', ['greater_to_smaller', 'smaller_to_greater']),
    ];
    const pagination_filters = [
        build_search_input_field(filters, 'limit', 'Limit', 'number'),
        build_search_input_field(filters, 'skip', 'Skip', 'number'),
    ];

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);
    fields_container.appendChild(build_field_group('Full Name', fullname_filters));
    fields_container.appendChild(build_field_group('Email', email_filters));
    fields_container.appendChild(build_field_group('Phone', phone_filters));
    fields_container.appendChild(build_field_group('Birth Date', birth_date_filters));
    fields_container.appendChild(build_field_group('Join Date', join_date_filters));
    fields_container.appendChild(build_field_group('Sort', sort_filters));
    fields_container.appendChild(build_field_group('Pagination', pagination_filters));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        { text: 'Search', className: 'btn btn-primary btn-lg', onClick: () => search_users_filters(), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

//=============== Contents: Search Filters Window ===============
function create_contents_filters_window(filters)
{
    const { overlay, content } = create_modal_shell('Contents filters Setup');

    const title_filters = [
        build_search_input_field(filters, 'title_starts', 'Starts with', 'text'),
        build_search_input_field(filters, 'title_ends', 'Ends with', 'text'),
        build_search_input_field(filters, 'title_contains', 'Contains', 'text'),
    ];
    const category_filters = [
        build_search_input_field(filters, 'exact_category', 'Exact', 'text'),
        build_search_input_field(filters, 'contain_category', 'Contains', 'text'),
        build_search_input_field(filters, 'exclude_category', 'Exclude', 'text'),
    ];
    const type_filters = [
        build_search_select_field(filters, 'type', 'Type', ['all', 'series', 'movie']),
    ];
    const release_date_filters = [
        build_search_input_field(filters, 'released_after', 'After', 'date'),
        build_search_input_field(filters, 'released_before', 'Before', 'date'),
    ];
    const age_limit_filters = [
        build_search_input_field(filters, 'min_age_limit', 'Min', 'number'),
        build_search_input_field(filters, 'max_age_limit', 'Max', 'number'),
    ];
    const likes_filters = [
        build_search_input_field(filters, 'min_likes', 'Minimum likes', 'number'),
    ];
    // average_rating/review_count are now real, filterable fields on every content object.
    const rating_review_filters = [
        build_search_input_field(filters, 'min_average_rating', 'Min avg rating', 'number'),
        build_search_input_field(filters, 'max_average_rating', 'Max avg rating', 'number'),
        build_search_input_field(filters, 'min_review_count', 'Min review count', 'number'),
        build_search_input_field(filters, 'max_review_count', 'Max review count', 'number'),
    ];
    const sort_filters = [
        build_search_select_field(filters, 'sort', 'Sort', ['createdAt', 'likes', 'title', 'age_limit', 'release_date', 'average_rating', 'review_count']),
        build_search_select_field(filters, 'sortOrder', 'Sort Order', ['greater_to_smaller', 'smaller_to_greater']),
    ];
    const pagination_filters = [
        build_search_input_field(filters, 'limit', 'Limit', 'number'),
        build_search_input_field(filters, 'skip', 'Skip', 'number'),
    ];

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);
    fields_container.appendChild(build_field_group('Title', title_filters));
    fields_container.appendChild(build_field_group('Categories (comma separated)', category_filters));
    fields_container.appendChild(build_field_group('Type', type_filters));
    fields_container.appendChild(build_field_group('Release Date', release_date_filters));
    fields_container.appendChild(build_field_group('Age Limit', age_limit_filters));
    fields_container.appendChild(build_field_group('Likes', likes_filters));
    fields_container.appendChild(build_field_group('Rating & Reviews', rating_review_filters));
    fields_container.appendChild(build_field_group('Sort', sort_filters));
    fields_container.appendChild(build_field_group('Pagination', pagination_filters));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        { text: 'Search', className: 'btn btn-primary btn-lg', onClick: () => search_contents_filters(), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

//=============== Reviews: Search Filters Window ===============
function create_reviews_filters_window(filters)
{
    const { overlay, content } = create_modal_shell('Reviews filters Setup');

    const id_filters = [
        build_search_input_field(filters, 'content_id', 'Content ID', 'text'),
        build_search_input_field(filters, 'episode_id', 'Episode ID', 'text'),
        build_search_input_field(filters, 'profile_id', 'Profile ID', 'text'),
        build_search_input_field(filters, 'user_id', 'User ID', 'text'),
    ];
    const rating_filters = [
        build_search_input_field(filters, 'rating', 'Exact', 'number'),
        build_search_input_field(filters, 'min_rating', 'Min', 'number'),
        build_search_input_field(filters, 'max_rating', 'Max', 'number'),
    ];
    const comment_filters = [
        build_search_input_field(filters, 'comment_starts', 'Starts with', 'text'),
        build_search_input_field(filters, 'comment_ends', 'Ends with', 'text'),
        build_search_input_field(filters, 'comment_contains', 'Contains', 'text'),
    ];
    const sort_filters = [
        build_search_select_field(filters, 'sort', 'Sort', ['rating']),
        build_search_select_field(filters, 'sortOrder', 'Sort Order', ['greater_to_smaller', 'smaller_to_greater']),
    ];
    const pagination_filters = [
        build_search_input_field(filters, 'limit', 'Limit', 'number'),
        build_search_input_field(filters, 'skip', 'Skip', 'number'),
    ];

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);
    fields_container.appendChild(build_field_group('IDs', id_filters));
    fields_container.appendChild(build_field_group('Rating', rating_filters));
    fields_container.appendChild(build_field_group('Comment', comment_filters));
    fields_container.appendChild(build_field_group('Sort', sort_filters));
    fields_container.appendChild(build_field_group('Pagination', pagination_filters));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        { text: 'Search', className: 'btn btn-primary btn-lg', onClick: () => search_reviews_filters(), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

//=============== Permission Window ===============
function create_set_permission_window(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return null;
    }

    const { overlay, content } = create_modal_shell(`Set Permission - ${user.fullName}`);

    const select = document.createElement('select');
    select.id = 'permission_level';
    select.className = 'form-select w-75 mx-auto my-4';

    // PermissionLookup maps numeric level -> name ({0: "USER", 1: "ADMIN", 2: "SUPER_ADMIN"}),
    // sorted numerically so the dropdown lists USER, ADMIN, SUPER_ADMIN in that order.
    Object.keys(PermissionLookup)
        .sort((a, b) => Number(a) - Number(b))
        .forEach(levelKey =>
        {
            const option_element = document.createElement('option');
            option_element.value = levelKey;
            option_element.textContent = PermissionLookup[levelKey];
            select.appendChild(option_element);
        });

    select.value = String(user.permission_level);
    content.appendChild(select);

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        {
            text: 'Save',
            className: 'btn btn-primary btn-lg',
            listenForEnter: true,
            onClick: async () =>
            {
                const newLevel = Number(select.value);
                if (newLevel === user.permission_level)
                {
                    close_filters_window();
                    UI.ShowMessage("No changes to update");
                    return;
                }

                const response = await Backend.setUserPermissionLevel(token, user.id, newLevel);
                if (!response.success)
                {
                    close_filters_window();
                    UI.ShowErrorMessage("Permission update failed, server error: " + response.message);
                    return;
                }

                // setUserPermissionLevel doesn't return the updated user, so update locally
                user.permission_level = newLevel;
                UI.ShowMessage("Permission level updated successfully");
                current_target = user;
                view_user();
                close_filters_window();
            }
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

//=============== Ban Window ===============
// Prompts the admin for how many hours to ban the user for, instead of using a
// fixed/hardcoded duration. Follows the same modal pattern as the Permission window above.
function create_ban_user_window(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return null;
    }

    const { overlay, content } = create_modal_shell(`Ban User - ${user.fullName}`);

    const label_p = document.createElement('p');
    label_p.className = LABEL_CLASSES;
    label_p.textContent = "Ban duration (hours):";
    content.appendChild(label_p);

    const hours_input = document.createElement('input');
    hours_input.type = 'number';
    hours_input.id = 'ban_hours';
    hours_input.min = '1';
    hours_input.value = '24'; // sensible default so the admin doesn't have to type anything for a "standard" ban
    hours_input.className = 'form-control w-50 mx-auto mb-4';
    content.appendChild(hours_input);

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        {
            text: 'Ban',
            className: 'btn btn-danger btn-lg',
            listenForEnter: true,
            onClick: async () =>
            {
                const hours = Number(hours_input.value);
                if (!hours || hours <= 0)
                {
                    UI.ShowErrorMessage("Please enter a valid number of hours");
                    return;
                }
                await ban_user_confirm(user, hours);
            }
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

//=============== Statistics Window ===============
// One "Statistics" button per MODE (users/contents/reviews). Each button calls its own
// backend endpoint (getUsersStatistics / getContentStatistics / getReviewsStatistics) and
// renders every number returned as a D3.js bar chart - no other charting library is used.

// ----- Small helper: round a number to 2 decimal places (used for average ratings, -----
// ----- since raw averages like 7.3333333 would otherwise make ugly chart labels).   -----
function round_to_two_decimal_places(raw_number)
{
    return Math.round((raw_number + Number.EPSILON) * 100) / 100;
}

/**
 * Draws one D3.js bar chart into `chart_container_element`.
 * This single function is reused for every chart in every statistics window below -
 * every one of our statistics is shaped the same way: an array of objects, each with
 * one category field (shown on the X axis) and one number field (shown as bar height).
 *
 * @param {HTMLElement} chart_container_element - empty <div> the chart will be built inside
 * @param {Array<Object>} chart_data_points - e.g. [{ Month: "2026-01", NewUsers: 12 }, ...]
 * @param {string} category_field_name - name of the field to use as the X axis label, e.g. "Month"
 * @param {string} value_field_name - name of the field to use as the bar height, e.g. "NewUsers"
 * @param {string} chart_title - text shown above the chart
 */
function draw_bar_chart_with_d3(chart_container_element, chart_data_points, category_field_name, value_field_name, chart_title)
{
    // Always start from a clean slate, in case this chart is being redrawn.
    chart_container_element.innerHTML = '';

    // ----- Title, shown above the chart itself -----
    const chart_title_element = document.createElement('h4');
    chart_title_element.className = 'text-warning text-center mt-4';
    chart_title_element.textContent = chart_title;
    chart_container_element.appendChild(chart_title_element);

    // If there's nothing to draw, say so instead of rendering an empty/broken chart.
    if (!chart_data_points || chart_data_points.length === 0)
    {
        const no_data_message = document.createElement('p');
        no_data_message.className = 'text-light text-center';
        no_data_message.textContent = 'No data available.';
        chart_container_element.appendChild(no_data_message);
        return;
    }

    // ----- Overall chart size, split into an outer SVG size and an inner drawing area -----
    // The margins leave room for the axis labels around the actual bars.
    const svg_total_width = 520;
    const svg_total_height = 320;
    const chart_margin = { top: 20, right: 20, bottom: 80, left: 50 };
    const drawing_area_width = svg_total_width - chart_margin.left - chart_margin.right;
    const drawing_area_height = svg_total_height - chart_margin.top - chart_margin.bottom;

    // ----- The SVG canvas itself -----
    const svg_element = d3.select(chart_container_element)
        .append('svg')
        .attr('width', svg_total_width)
        .attr('height', svg_total_height)
        .attr('class', 'd-block mx-auto');

    // A <g> group shifted inward by the margins - everything we draw below goes inside
    // this group, so it never overlaps the axis labels.
    const drawing_area_group = svg_element.append('g')
        .attr('transform', `translate(${chart_margin.left}, ${chart_margin.top})`);

    // ----- X axis: one evenly-spaced "band" (slot) per category (e.g. one per month) -----
    const x_axis_scale = d3.scaleBand()
        .domain(chart_data_points.map(data_point => String(data_point[category_field_name])))
        .range([0, drawing_area_width])
        .padding(0.25);

    // ----- Y axis: linear scale from 0 up to the largest value present in the data -----
    const largest_value_in_data = d3.max(chart_data_points, data_point => data_point[value_field_name]) || 1;
    const y_axis_scale = d3.scaleLinear()
        .domain([0, largest_value_in_data])
        .range([drawing_area_height, 0]); // SVG's Y axis grows downward, so this flips it

    // ----- Draw the X axis line + category labels along the bottom -----
    drawing_area_group.append('g')
        .attr('transform', `translate(0, ${drawing_area_height})`)
        .call(d3.axisBottom(x_axis_scale))
        .selectAll('text')
        .attr('fill', 'white')
        .attr('transform', 'rotate(-30)') // angled so longer labels (e.g. category names) don't overlap
        .style('text-anchor', 'end');

    // ----- Draw the Y axis line + numeric ticks along the left -----
    drawing_area_group.append('g')
        .call(d3.axisLeft(y_axis_scale).ticks(5))
        .selectAll('text')
        .attr('fill', 'white');

    // Both axis lines are black by default, which is invisible on this page's dark
    // background - force them (and their tick marks) to white so they're visible.
    drawing_area_group.selectAll('.domain, .tick line').attr('stroke', 'white');

    // ----- One bar per data point -----
    drawing_area_group.selectAll('.statistics-bar')
        .data(chart_data_points)
        .enter()
        .append('rect')
        .attr('class', 'statistics-bar')
        .attr('x', data_point => x_axis_scale(String(data_point[category_field_name])))
        .attr('y', data_point => y_axis_scale(data_point[value_field_name]))
        .attr('width', x_axis_scale.bandwidth())
        .attr('height', data_point => drawing_area_height - y_axis_scale(data_point[value_field_name]))
        .attr('fill', '#0d6efd');

    // ----- The exact numeric value, printed just above each bar -----
    drawing_area_group.selectAll('.statistics-bar-label')
        .data(chart_data_points)
        .enter()
        .append('text')
        .attr('class', 'statistics-bar-label')
        .attr('x', data_point => x_axis_scale(String(data_point[category_field_name])) + x_axis_scale.bandwidth() / 2)
        .attr('y', data_point => y_axis_scale(data_point[value_field_name]) - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .text(data_point => data_point[value_field_name]);
}

/**
 * Shared shell for all 3 statistics windows: opens the modal, shows a loading message,
 * calls `fetch_statistics_function()`, and once it resolves either shows an error message
 * or hands the returned `statistics` object to `render_charts_function` to draw into
 * `charts_container_element`.
 *
 * @param {string} window_title
 * @param {() => Promise<Object>} fetch_statistics_function - e.g. () => Backend.getUsersStatistics(token)
 * @param {(charts_container_element: HTMLElement, statistics: Object) => void} render_charts_function
 */
function create_statistics_window(window_title, fetch_statistics_function, render_charts_function)
{
    const { overlay, content } = create_modal_shell(window_title, { widthClass: 'col-11 col-lg-8' });

    const loading_message = document.createElement('p');
    loading_message.className = 'text-light fs-5';
    loading_message.textContent = 'Loading statistics...';
    content.appendChild(loading_message);

    // All the charts get appended into this single container once the data arrives.
    const charts_container_element = document.createElement('div');
    charts_container_element.className = 'w-100';
    content.appendChild(charts_container_element);

    content.appendChild(create_button_row([
        { text: 'Close', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
    ]));

    document.body.appendChild(overlay);

    // Runs in the background - the modal above is already visible with "Loading...",
    // this just fills it in (or shows an error) once the request comes back.
    (async () =>
    {
        const response = await fetch_statistics_function();
        loading_message.remove();

        if (!response.success || !response.statistics)
        {
            const error_message = document.createElement('p');
            error_message.className = 'text-danger fs-5';
            error_message.textContent = 'Failed to load statistics: ' + (response.message || 'unknown error');
            charts_container_element.appendChild(error_message);
            return;
        }

        render_charts_function(charts_container_element, response.statistics);
    })();

    return overlay;
}

// ----- Users mode: 3 charts, matching Backend.getUsersStatistics()'s response shape -----
function render_users_statistics_charts(charts_container_element, statistics)
{
    const profile_distribution_chart = document.createElement('div');
    charts_container_element.appendChild(profile_distribution_chart);
    draw_bar_chart_with_d3(profile_distribution_chart, statistics.profileDistribution, 'NumberOfProfiles', 'UsersCount', 'Profiles per User');

    const user_growth_chart = document.createElement('div');
    charts_container_element.appendChild(user_growth_chart);
    draw_bar_chart_with_d3(user_growth_chart, statistics.userGrowth, 'Month', 'NewUsers', 'New Users per Month');

    const age_distribution_chart = document.createElement('div');
    charts_container_element.appendChild(age_distribution_chart);
    draw_bar_chart_with_d3(age_distribution_chart, statistics.ageDistribution, 'AgeRange', 'UsersCount', 'Users by Age Range');
}

function create_users_statistics_window()
{
    return create_statistics_window(
        'Users Statistics',
        () => Backend.getUsersStatistics(token),
        render_users_statistics_charts
    );
}

// ----- Contents mode: 5 charts + one plain-text average, matching Backend.getContentStatistics()'s NEW response shape -----
// (viewsByCategory: [{ Category, ViewsCount }] and mostViewedContent: [{ Title, ViewsCount }] added as the first two charts)
function render_content_statistics_charts(charts_container_element, statistics)
{
    const views_by_category_chart = document.createElement('div');
    charts_container_element.appendChild(views_by_category_chart);
    draw_bar_chart_with_d3(views_by_category_chart, statistics.viewsByCategory, 'Category', 'ViewsCount', 'Views by Category');

    const most_viewed_content_chart = document.createElement('div');
    charts_container_element.appendChild(most_viewed_content_chart);
    draw_bar_chart_with_d3(most_viewed_content_chart, statistics.mostViewedContent, 'Title', 'ViewsCount', 'Most Viewed Content (Top 5)');

    const category_distribution_chart = document.createElement('div');
    charts_container_element.appendChild(category_distribution_chart);
    draw_bar_chart_with_d3(category_distribution_chart, statistics.categoryDistribution, 'Category', 'TitlesCount', 'Titles per Category');

    // averageEpisodesPerSeries is a single number, not a list - shown as plain text
    // rather than a (pointless) one-bar chart.
    const average_episodes_message = document.createElement('p');
    average_episodes_message.className = 'text-light fs-5 text-center mt-4';
    average_episodes_message.textContent =
        `Average Episodes per Series: ${round_to_two_decimal_places(statistics.episodesPerSeriesStats.averageEpisodesPerSeries)}`;
    charts_container_element.appendChild(average_episodes_message);

    const episodes_distribution_chart = document.createElement('div');
    charts_container_element.appendChild(episodes_distribution_chart);
    draw_bar_chart_with_d3(
        episodes_distribution_chart,
        statistics.episodesPerSeriesStats.episodesDistribution,
        'EpisodesRange', 'SeriesCount', 'Series by Episode Count'
    );

    const age_distribution_chart = document.createElement('div');
    charts_container_element.appendChild(age_distribution_chart);
    draw_bar_chart_with_d3(age_distribution_chart, statistics.ageDistribution, 'AgeRange', 'TitlesCount', 'Titles by Age Rating');
}

function create_content_statistics_window()
{
    return create_statistics_window(
        'Content Statistics',
        () => Backend.getContentStatistics(token),
        render_content_statistics_charts
    );
}

// ----- Reviews mode: 3 charts, matching Backend.getReviewsStatistics()'s response shape -----
function render_reviews_statistics_charts(charts_container_element, statistics)
{
    const rating_distribution_chart = document.createElement('div');
    charts_container_element.appendChild(rating_distribution_chart);
    draw_bar_chart_with_d3(rating_distribution_chart, statistics.ratingDistribution, 'Rating', 'ReviewsCount', 'Reviews by Rating (1-10)');

    // AverageRating values are decimals (e.g. 7.3333) - round them to 2 decimal places
    // before charting so the bar labels look clean.
    const rounded_category_average_ratings = statistics.categoryAverageRating.map(entry => ({
        Category: entry.Category,
        AverageRating: round_to_two_decimal_places(entry.AverageRating)
    }));
    const category_average_rating_chart = document.createElement('div');
    charts_container_element.appendChild(category_average_rating_chart);
    draw_bar_chart_with_d3(category_average_rating_chart, rounded_category_average_ratings, 'Category', 'AverageRating', 'Average Rating per Category');

    const monthly_review_count_chart = document.createElement('div');
    charts_container_element.appendChild(monthly_review_count_chart);
    draw_bar_chart_with_d3(monthly_review_count_chart, statistics.monthlyAverageRating, 'Month', 'ReviewsCount', 'Reviews Count per Month');
}

function create_reviews_statistics_window()
{
    return create_statistics_window(
        'Reviews Statistics',
        () => Backend.getReviewsStatistics(token),
        render_reviews_statistics_charts
    );
}
// Separated from create_ban_user_window() so the actual API call + list update
// logic isn't buried inside the button's inline onClick handler.
async function ban_user_confirm(user, hours_to_ban)
{
    const response = await Backend.banUser(token, user.id, hours_to_ban);
    if (!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage("Ban failed, server error: " + response.message);
        return;
    }

    UI.ShowMessage(`User banned successfully for ${hours_to_ban} hours`);
    // A banned user shouldn't stay in the visible list, same as kick/delete below.
    users = users.filter(u => u.id !== user.id);
    if (current_target === user) current_target = null;
    if (user.id === active_user.id)
    {
        close_filters_window();
        redirectToIndex();
        return;
    }
    main_renderer();
    close_filters_window();
}

//=============== Select by ID Window ===============
// Generic "jump straight to this ID" modal, shared by all three modes. For Users and
// Content this fetches directly from the server (works even for an id outside the
// currently loaded/filtered list, since fetchUserById/getContentByID are dedicated
// get-by-id endpoints). Reviews has no get-by-id endpoint at all on the backend
// (searchReviews only filters by content_id/episode_id/profile_id/user_id, not the
// review's own id) - so that one can only match against whatever's already loaded in
// the current reviews search results.
function create_select_by_id_window(entity_label, on_select)
{
    const { overlay, content } = create_modal_shell(`Select ${entity_label} by ID`);

    const label_p = document.createElement('p');
    label_p.className = LABEL_CLASSES;
    label_p.textContent = `${entity_label} ID:`;
    content.appendChild(label_p);

    const id_input = document.createElement('input');
    id_input.type = 'text';
    id_input.id = 'select_by_id_input';
    id_input.className = 'form-control w-75 mx-auto mb-4';
    content.appendChild(id_input);

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        {
            text: 'Select',
            className: 'btn btn-primary btn-lg',
            listenForEnter: true,
            onClick: async () =>
            {
                const id = id_input.value.trim();
                if (!id)
                {
                    UI.ShowErrorMessage('Please enter an ID');
                    return;
                }
                await on_select(id);
            }
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function select_user_by_id(id)
{
    const response = await Backend.fetchUserById(token, id);
    if (!response.success || !response.user)
    {
        close_filters_window();
        UI.ShowErrorMessage("User not found: " + (response.message || 'unknown error'));
        return;
    }
    current_target = response.user;
    close_filters_window();
    await view_user(); // view_user() already calls rander_mode_selector() internally
}

async function select_content_by_id(id)
{
    const response = await Backend.getContentByID(id);
    if (!response.success || !response.content)
    {
        close_filters_window();
        UI.ShowErrorMessage("Content not found: " + (response.message || 'unknown error'));
        return;
    }
    current_target = response.content;
    close_filters_window();
    await view_content(); // view_content() already calls rander_mode_selector() internally
}

// See the note above create_select_by_id_window() - this can only find a match among
// whatever's already loaded in the current reviews search results.
async function select_review_by_id(id)
{
    const found = reviews.find(r => r.id === id);
    if (!found)
    {
        close_filters_window();
        UI.ShowErrorMessage("Review not found in the currently loaded list - try adjusting the review search filters first.");
        return;
    }
    current_target = found;
    close_filters_window();
    view_review(); // view_review() already calls rander_mode_selector() internally
}

// NOTE: relies on Backend.findUserByProfileId(), which maps to a new admin endpoint
// (GET /admin/profiles/:profileId/owner) that does not exist on the server yet - see
// admin-find-user-by-profile.js for the controller code to integrate server-side.
async function select_user_by_profile_id(profileId)
{
    const response = await Backend.findUserByProfileId(token, profileId);
    if (!response.success || !response.user)
    {
        close_filters_window();
        UI.ShowErrorMessage("User not found for that profile ID: " + (response.message || 'unknown error'));
        return;
    }
    current_target = response.user;
    close_filters_window();
    await view_user(); // view_user() already calls rander_mode_selector() internally
}

//=============== Confirmation / Delete ===============

function create_confirmation_window(message, onConfirm, confirmText = 'Delete')
{
    const { overlay, content } = create_modal_shell('Are you sure?', {
        widthClass: 'col-10 col-md-6',
        titleClass: 'mb-3 text-danger fw-bold fs-2'
    });

    const message_p = document.createElement('p');
    message_p.className = 'text-white fs-5 mb-4';
    message_p.textContent = message;
    content.appendChild(message_p);

    const warning_p = document.createElement('p');
    warning_p.className = 'text-warning fw-bold mb-4';
    warning_p.textContent = 'This action cannot be undone.';
    content.appendChild(warning_p);

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        { text: confirmText, className: 'btn btn-danger btn-lg', onClick: async () => { await onConfirm(); }, listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

function delete_content_click(content)
{
    if (!content || !(content instanceof ContentItem))
    {
        UI.ShowErrorMessage("No content selected");
        return;
    }

    open_window(() => create_confirmation_window(
        `Are you sure you want to delete "${content.title}"?`,
        async () =>
        {
            const response = await Backend.deleteContent(token, content.id);
            if (!response.success)
            {
                close_filters_window();
                UI.ShowErrorMessage("Deletion failed, server error: " + response.message);
                return;
            }

            UI.ShowMessage("Content deleted successfully");
            contents = contents.filter(c => c.id !== content.id);
            if (current_target === content) current_target = null;
            main_renderer();
            close_filters_window();
        }
    ));
}

function delete_user_click(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return;
    }

    open_window(() => create_confirmation_window(
        `Are you sure you want to delete "${user.fullName}"?`,
        async () =>
        {
            const response = await Backend.deleteUser(token, user.id);
            if (!response.success)
            {
                close_filters_window();
                UI.ShowErrorMessage("Deletion failed, server error: " + response.message);
                return;
            }

            UI.ShowMessage("User deleted successfully");
            users = users.filter(u => u.id !== user.id);
            if (current_target === user) current_target = null;
            main_renderer();
            close_filters_window();
        }
    ));
}

function delete_review_click(review)
{
    if (!review || !(review instanceof Review))
    {
        UI.ShowErrorMessage("No review selected");
        return;
    }

    open_window(() => create_confirmation_window(
        `Are you sure you want to delete this review (Rating: ${review.rating}/10)?`,
        async () =>
        {
            const response = await Backend.adminDeleteReview(token, review.id);
            if (!response.success)
            {
                close_filters_window();
                UI.ShowErrorMessage("Deletion failed, server error: " + response.message);
                return;
            }

            UI.ShowMessage("Review deleted successfully");
            reviews = reviews.filter(r => r.id !== review.id);
            if (current_target === review) current_target = null;
            main_renderer();
            close_filters_window();
        }
    ));
}

function kick_user_click(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return;
    }
    open_window(() => create_confirmation_window(
        `Are you sure you want to kick "${user.fullName}"?`,
        async () =>
        {
            const response = await Backend.kickUser(token, user.id);
            if (!response.success)
            {
                close_filters_window();
                UI.ShowErrorMessage("Kick failed, server error: " + response.message);
                return;
            }
            UI.ShowMessage("User kicked successfully");
            users = users.filter(u => u.id !== user.id);
            if (user.id === active_user.id)
            {
                close_filters_window();
                redirectToIndex();
                return;
            }
            main_renderer();
            close_filters_window();
        },
        'Kick' 
    ));
}

//=============== Main Renderer ===============
// Central switchboard: every mode change (users/contents/reviews) re-runs through here.
// Each case does 3 things in order: (1) toggle CSS transforms/opacity for the
// show/hide animation, (2) wire up the mode-specific action buttons, (3) render
// the selection list + detail view for that mode.
function main_renderer()
{
    switch (current_mode)
    {
        case mode.users:
        {
            selection_container.style.display = "block";
            view_container.style.display = "block";
            controll_container.style.display = "block";
            selection_counter.style.display = "block";

            // requestAnimationFrame ensures the display:block above has been painted
            // before the transform/opacity transition starts, so the animation actually plays.
            requestAnimationFrame(() =>
            {
                selection_container.style.transform = "scale(1, 1)";
                view_container.style.transform = "scale(1, 1)";
                controll_container.style.opacity = "1";
                selection_counter.style.opacity = "1";
            });
            render_controll_container([
                {name: "Kick", primary: true, function: () => kick_user_click(current_target)},
                {name: "Search", function: () => open_window(() => create_users_filters_window(users_filters))},
                {name: "Select by ID", function: () => open_window(() => create_select_by_id_window('User', select_user_by_id))},
                {name: "Select by Profile ID", function: () => open_window(() => create_select_by_id_window('Profile', select_user_by_profile_id))},
                {name: "Update", function: () => open_window(() => create_update_user_window(current_target))},
                {name: "Delete", function: () => delete_user_click(current_target)},
                {name: "My User", function: () => {current_target = active_user; view_user()}},
                {name: "Set Permission", function: () => open_window(() => create_set_permission_window(current_target))},
                {name: "Ban", primary: true, function: () => open_window(() => create_ban_user_window(current_target))},
                {name: "Statistics", function: () => open_window(() => create_users_statistics_window())},
            ]);
            rander_selection_container_to_users();
            view_user();
            break;
        }
        case mode.contents:
        {
            selection_container.style.display = "block";
            view_container.style.display = "block";
            controll_container.style.display = "block";
            selection_counter.style.display = "block";

            requestAnimationFrame(() =>
            {
                selection_container.style.transform = "scale(1, 1)";
                view_container.style.transform = "scale(1, 1)";
                controll_container.style.opacity = "1";
                selection_counter.style.opacity = "1";
            });
            render_controll_container([
                {name: "Add", primary: true, function: () => open_window(() => create_update_content_window())},
                {name: "Search", function: () => open_window(() => create_contents_filters_window(contents_filters))},
                {name: "Select by ID", function: () => open_window(() => create_select_by_id_window('Content', select_content_by_id))},
                {name: "Update", primary: true, function: () => open_window(() => create_update_content_window(current_target))},
                {name: "Delete", function: () => delete_content_click(current_target)},
                {name: "Statistics", function: () => open_window(() => create_content_statistics_window())},
            ]);
            rander_selection_container_to_contents();
            view_content();
            break;
        }
        case mode.reviews:
        {
            selection_container.style.display = "block";
            view_container.style.display = "block";
            controll_container.style.display = "block";
            selection_counter.style.display = "block";

            requestAnimationFrame(() =>
            {
                selection_container.style.transform = "scale(1, 1)";
                view_container.style.transform = "scale(1, 1)";
                controll_container.style.opacity = "1";
                selection_counter.style.opacity = "1";
            });
            render_controll_container([
                {name: "Search", function: () => open_window(() => create_reviews_filters_window(reviews_filters))},
                {name: "Select by ID", function: () => open_window(() => create_select_by_id_window('Review', select_review_by_id))},
                {name: "Update", primary: true, function: () => open_window(() => create_update_review_window(current_target))},
                {name: "Delete", function: () => delete_review_click(current_target)},
                {name: "Statistics", function: () => open_window(() => create_reviews_statistics_window())},
            ]);
            rander_selection_container_to_reviews();
            view_review();
            break;
        }
    }
    rander_mode_selector();
}

//=============== Error Handling / Bootstrap ===============

if (!mode_selector_container) throw new Error("mode_selector_container not found");
if (!selection_counter) throw new Error("selection_counter not found");
if (!controll_container) throw new Error("controll_container not found");
if (!selection_container) throw new Error("selection_container not found");
if (!view_container) throw new Error("view_container not found");
if (!msg_box) throw new Error("msg_box not found");

search_contents_filters();
search_users_filters();
search_reviews_filters();
UI.ClearMessage();

export { create_update_user_window };
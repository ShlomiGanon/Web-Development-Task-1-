//i know this code is can be reused for other pages but i dont have time to refactor it , sorry for that.

import { UserInfo, ContentItem } from "./BACKEND_API/backend-interface.js";
import { Backend } from "./config.js";
import {ClientSessionManager} from "./client-session-manager.js";
import * as UI from "./ui-utils.js";

//=============== Session / Auth Bootstrap ===============
// Order matters here: each check can redirect away, so later lines assume
// everything above them already succeeded (token exists, user exists, etc).
const token = ClientSessionManager.getSessionToken();
if(!token)redirectToIndex();
let active_user = (await Backend.fetchActiveUserInfo(token)).user;
if(!active_user)redirectToIndex();
if(!active_user.permission_level)redirectToIndex();
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
    "empty": 0,
    "users": 1,
    "contents": 2
});
// Reverse lookup (1 -> "users") - used by the mode-selector buttons to display names.
const numbers_to_modes = Object.fromEntries(Object.entries(mode).map(([key, value]) => [value, key]));
let current_mode = mode.users;

let users = [];
let contents = [];
let users_filters = {};
let contents_filters = {};

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

function redirectToIndex(button_was_pressed = null)
{
    UI.LockUI(button_was_pressed);
    UI.GoToLink("/");
}
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
        btn.addEventListener('click', onClick);
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
// "Edit" fields (used by Update User / Update+Add Content windows) compare their live
// value against the target object's current value, highlighting the label when changed.
// `target` may be null (create mode) - handled the same way an empty original value would be.
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

// "Search" fields (used by the Users/Contents filter windows) just track whether the
// user has typed/selected a value at all - there's no "original" object to compare to.
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
        <p>${response.message}</p>
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
        ${renderField("Video URL", escapeHtml(current_target.videoUrl))}
        ${renderField("Release Date", escapeHtml(current_target.release_date.toLocaleDateString()))}
        ${renderField("Created At", escapeHtml(current_target.createdAt.toLocaleDateString()))}
        ${renderField("IMDB Rating", escapeHtml(current_target.imdb_rating))}
    </div>
    `;
    view_container.innerHTML = contentHtml;
    rander_mode_selector();
}

function view_user()
{
    if (!current_target || !(current_target instanceof UserInfo))
    {
        view_container.innerHTML = `
        <h1>No user selected</h1>
        <p>Please select a user from the list</p>
        `;
        return;
    }

    const userHtml = `
    <div class="w-100 p-4">
        <h1 class="fw-bold mb-4">${escapeHtml(current_target.fullName)}</h1>
        ${renderField("ID", escapeHtml(current_target.id))}
        ${renderField("Email", escapeHtml(current_target.email))}
        ${renderField("Phone", escapeHtml(current_target.phone))}
        ${renderField("Birthday", escapeHtml(current_target.birthday.toLocaleDateString()))}
        ${renderField("Created At", escapeHtml(current_target.createdAt.toLocaleDateString()))}
        ${renderField("Permission Level", escapeHtml(current_target.permission_level))}
    </div>
    `;
    view_container.innerHTML = userHtml;
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
    else last_mode = undefined;
    const back_button = document.createElement("button");
    back_button.className = "btn btn-group btn-lg btn-outline-light rounded-pill";
    back_button.textContent = "Back to profiles";
    back_button.addEventListener("click", () => 
    {
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
// Shared by both users and contents: a clickable card with a title + secondary line.
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

// Used by Update/Create windows: reads every input/select in the modal as-is,
// with no special-casing - the caller (update_user/update_content) does the
// "did this actually change" comparison against the original object itself.
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
function create_update_content_window(contentItem = null)
{
    if (!contentItem || !(contentItem instanceof ContentItem))
    {
        UI.ShowErrorMessage("no content selected");
        return null;
    }
    const is_create_mode = !contentItem;

    const { overlay, content } = create_modal_shell(is_create_mode ? 'Add Content' : 'Update Content');

    const fields_container = document.createElement('div');
    fields_container.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fields_container);

    // maps to: { title, description, cover_image_name, type, categories, release_date, age_limit, videoUrl } on ContentItem
    fields_container.appendChild(build_edit_input_field(contentItem, 'title', "Title", 'text'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'description', "Description", 'text'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'cover_image_name', "Cover Image Name", 'text'));
    fields_container.appendChild(build_edit_select_field(contentItem, 'type', "Type", ['movie', 'series']));
    fields_container.appendChild(build_edit_input_field(contentItem, 'categories', "Categories", 'text'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'release_date', "Release Date", 'date'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'age_limit', "Age Limit", 'number'));
    fields_container.appendChild(build_edit_input_field(contentItem, 'videoUrl', "Video URL", 'text'));

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
        build_search_select_field(filters, 'sort', 'Sort', ['createdAt', 'birthDate', 'fullName', 'email']),
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
    const sort_filters = [
        build_search_select_field(filters, 'sort', 'Sort', ['release_date', 'likes', 'title', 'age_limit', 'createdAt']),
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
    fields_container.appendChild(build_field_group('Sort', sort_filters));
    fields_container.appendChild(build_field_group('Pagination', pagination_filters));

    content.appendChild(create_button_row([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => close_filters_window() },
        { text: 'Search', className: 'btn btn-primary btn-lg', onClick: () => search_contents_filters(), listenForEnter: true },
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
    if(user.id === active_user.id)redirectToIndex();
    main_renderer();
    close_filters_window();
}

//=============== Confirmation / Delete ===============
function create_confirmation_window(message, onConfirm)
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
        { text: 'Delete', className: 'btn btn-danger btn-lg', onClick: async () => { await onConfirm(); }, listenForEnter: true },
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

    filters_window = create_confirmation_window(
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
    );
}

function delete_user_click(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return;
    }

    filters_window = create_confirmation_window(
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
    );
}

function kick_user_click(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return;
    }
    filters_window = create_confirmation_window(
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
            if(user.id === active_user.id)redirectToIndex();
            main_renderer();
            close_filters_window();
        }
    );
}

//=============== Main Renderer ===============
// Central switchboard: every mode change (empty/users/contents) re-runs through here.
// Each case does 3 things in order: (1) toggle CSS transforms/opacity for the
// show/hide animation, (2) wire up the mode-specific action buttons, (3) render
// the selection list + detail view for that mode.
function main_renderer()
{
    switch (current_mode)
    {
        
        case mode.empty:
        {
            // Animate out, then actually hide (display:none) once the transition finishes -
            // hiding immediately would skip the animation entirely.
            selection_container.style.transform = "scale(1, 0)";
            selection_counter.style.opacity = "0";
            view_container.style.transform = "scale(1, 0)";
            controll_container.style.opacity = "0";
            setTimeout(() =>
            {
                selection_counter.style.display = "none";
                selection_container.style.display = "none";
                view_container.style.display = "none";
                controll_container.style.display = "none";
            }, 300);
            break;
        }
        
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
                {name: "Search", function: () => filters_window = create_users_filters_window(users_filters)},
                {name: "Update", function: () => filters_window = create_update_user_window(current_target)},
                {name: "Delete", function: () => delete_user_click(current_target)},
                {name: "My User", function: () => {current_target = active_user; view_user()}},
                {name: "Set Permission", function: () => filters_window = create_set_permission_window(current_target)},
                {name: "Ban", primary: true, function: () => filters_window = create_ban_user_window(current_target)},
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
                {name: "Add", primary: true, function: () => filters_window = create_update_content_window()},
                {name: "Search", function: () => filters_window = create_contents_filters_window(contents_filters)},
                {name: "Update", primary: true, function: () => filters_window = create_update_content_window(current_target)},
                {name: "Delete", function: () => delete_content_click(current_target)},
            ]);
            rander_selection_container_to_contents();
            view_content();
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
UI.ClearMessage();

export { create_update_user_window };

import { UserInfo, ContentItem } from "./BACKEND_API/backend-interface.js";
import { Backend } from "./config.js";
import {ClientSessionManager} from "./client-session-manager.js";
import * as UI from "./ui-utils.js";
//--------------------------------------------------
const token = ClientSessionManager.getSessionToken();
if(!token)throw new Error("No token found");
const active_user = (await Backend.fetchActiveUserInfo(token)).user;
if(!active_user)throw new Error("User not found");
if(!active_user.permission_level)throw new Error("User is not authorized to access the admin dashboard");
let current_target = active_user;
//--------------------------------------------------
const Permmision_Level = 
{
    SUPER_ADMIN: 2,
    ADMIN: 1,
    USER: 0
}

const PermissionLookup = Object.fromEntries(
    Object.entries(Permmision_Level).map(([key, val]) => [val, key])
);
//--------------------------------------------------
const mode_selector_container = document.getElementById("mode_selector_container");//to be able to switch between modes
const controll_container = document.getElementById("controll_container");//to show information
const selection_container = document.getElementById("selection_container");//to show information
const selection_counter = document.getElementById("selection_counter");//to show the selection counter
const view_container = document.getElementById("view_container");//the place to rander.
const msg_box = document.getElementById("msg_box");//to show messages
let filters_window = null;
let filters_listener = null;
const mode = Object.freeze({
    "empty": 0,
    "users": 1,
    "contents": 2
});

const numbers_to_modes = Object.fromEntries(Object.entries(mode).map(([key, value]) => [value, key]));
let current_mode = mode.empty;

let users = [];
let contents = [];
let users_filters = {};
let contents_filters = {};
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

function view_content()
{
    if (!current_target || !(current_target instanceof ContentItem))
    {
        UI.ShowMessage("No content selected");
        view_container.innerHTML = `
        <h1>No content selected</h1>
        <p>Please select a content from the list</p>
        `;
        return;
    }
    /*     * @param {string} id - Unique identifier as returned by the backend (opaque, do not assume a numeric format).
     * @param {string} name - Content title.
     * @param {string} [cover_imageName] - Cover image filename.
     * @param {number} [likes=0]
     * @param {string} [type] - "movie" | "series".
     * @param {Array<string>} [categories=[]]
     * @param {string} [description]
     * @param {number} [age_limit=0]
     * @param {string} [videoUrl]
     * @param {string} [release_date]
     * @param {string} [createdAt]*/
    const image_element = document.createElement('img');
    image_element.src = `/assets/covers/${escapeHtml(current_target.cover_image_name)}`;
    image_element.className = 'img-fluid';
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
    </div>
    `;
    //i want to show the cover image in the background of the view_container
    view_container.innerHTML = contentHtml;

}

function view_user()
{
    if (!current_target || !(current_target instanceof UserInfo))
    {
        UI.ShowMessage("No user selected");
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
    //add all the buttons to a new html element and then assing that elemnt to be the controll innerhtml
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



//=============== Mode Selector Renderer ===============
function rander_mode_selector()
{
    clear_mode_selector_container();
    let last_mode;
    if(current_target instanceof UserInfo)
    {
        last_mode = mode.users;
    }
    else if(current_target instanceof ContentItem)
    {
        last_mode = mode.contents;
    }
    else
    {
        last_mode = mode.empty;
    }
    Object.entries(mode).forEach(([key, value]) => 
    {
        const btn = document.createElement("button");
        btn.className = "btn btn-group btn-lg btn-outline-light rounded-pill";
        if (value === current_mode) btn.classList.add("active");
        if(value === last_mode) btn.classList.add("text-warning");
        btn.textContent = key.toUpperCase() + " Mode";
        // add direct listener to the DOM Element
        btn.addEventListener("click", () => switch_mode(value));
        mode_selector_container.appendChild(btn);
    });
}


function rander_selection_container_to_users()
{
    selection_counter.textContent = `Users Counter: ${users.length}`;
    clear_selection_container();
    if(!users || users.length === 0)
    {
        const title = document.createElement("h3");
        title.className = "text-dark fw-bold text-center";
        title.textContent = "No Users Found";
        selection_container.replaceChildren(title);
        return;
    }

        const sorted_by = users_filters.sort || "createdAt";

        const sorted_by_type = (sorted_by === "createdAt" || sorted_by === "birthday") ? "date" : "text";
        let elements_info = users.map(user => {return {id: user.id, title: user.fullName, secondery_title: (sorted_by_type === "date") ? user[sorted_by].toLocaleDateString() : user[sorted_by]}});
        if(!elements_info)return;
        const on_click_function = (id) => {current_target = users.find(user => user.id === id); view_user();};
        elements_info.forEach(element_info => {
            const title_container = document.createElement("div");
            const secondery_container = document.createElement("div");
            title_container.className = "w-100";
            secondery_container.className = "w-100";
            const title = document.createElement("h3");
            title.className = "text-danger fw-bold text-center";
            title.textContent = element_info.title;
            title_container.appendChild(title);
            const secondery_title = document.createElement("p");
            secondery_title.className = "text-light text-center";
            secondery_title.textContent = element_info.secondery_title;
            secondery_container.appendChild(secondery_title);

            const element_container = document.createElement("div");
            element_container.className = "m-2 w-100 border border-secondary";
            element_container.appendChild(title_container);
            element_container.appendChild(secondery_container);
            element_container.addEventListener("click", () => {on_click_function(element_info.id)});
            selection_container.appendChild(element_container);

        });

}

async function search_users_filters() 
{
    users_filters = get_filters_from_window(filters_window);
    const response = await Backend.searchUsers(token, users_filters);
    if(!response.success)
    {
        UI.ShowErrorMessage(response.message);
        return;
    }
    else
    {
        UI.ShowMessage(response.message);
    }
    console.log(response.users);
    users = response.users;
    main_renderer();
    close_filters_window();
}
async function search_contents_filters() 
{
    contents_filters = get_filters_from_window(filters_window);
    const response = await Backend.getAllContentItems(contents_filters);
    if(!response.success)
    {
        UI.ShowMessage(response.message);
        return;
    }
    contents = response.content;
    main_renderer();
    close_filters_window();
}
function get_filters_from_window(filters_window)
{
    const filters = {};
    const inputs = filters_window.querySelectorAll('input');
    inputs.forEach(input => {
        filters[input.id] = input.value;
    });
    const selects = filters_window.querySelectorAll('select');
    selects.forEach(select => {
        filters[select.id] = select.value;
    });
    return filters;
}
function close_filters_window() 
{
    if(filters_window)
    {
        filters_window.remove();
        filters_window = null;
    }
    if(filters_listener)
    {
        document.removeEventListener('keydown', filters_listener); 
        filters_listener = null;
    }
}

function add_filters_listener(enter_like_press_button)
{
    const handler = (event) => 
    {
        if(event.key === 'Escape')
        {
            close_filters_window();
        }
        if (event.key === 'Enter')
        {
            enter_like_press_button.click();
        }
    };
    document.addEventListener('keydown', handler);
    filters_listener = handler;
}
function create_update_user_window(user) {
    if(!user || !(user instanceof UserInfo))
    {
        UI.ShowErrorMessage("No user selected");
        return null;
    }
    const filters_window_overlay = document.createElement('div');
    filters_window_overlay.className = ' position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75';
    filters_window_overlay.style.zIndex = '1050';

    const filters_window_content = document.createElement('div');
    filters_window_content.className = 'col-10 bg-dark bg-opacity-75 p-4 rounded shadow-lg text-center';
    filters_window_content.style.maxHeight = '90vh';
    filters_window_content.style.overflowY = 'auto';


    const title = document.createElement('h1');
    title.className = 'mb-3 text-danger fw-bold fs-1';
    title.textContent = 'Update User';
    filters_window_content.appendChild(title);


    const cancel_button = document.createElement('button');
    cancel_button.className = 'btn btn-secondary btn-lg';
    cancel_button.textContent = 'Cancel';
    cancel_button.addEventListener('click', () => {
        close_filters_window();
    });
    //we not add it now because we want to add it to the bottom of the filters_window_content

    const update_button = document.createElement('button');
    update_button.className = 'btn btn-primary btn-lg';
    update_button.textContent = 'Update';
    update_button.addEventListener('click', () => {
        update_user(user);
    });
    add_filters_listener(update_button);
    //we not add it now because we want to add it to the bottom of the filters_window_content

    const filters_container = document.createElement('div');
    filters_container.className = 'col-12 text-start';
    filters_window_content.appendChild(filters_container);


    //=============== Build filters ===============
    const filther_classes = "col-12 d-flex justify-content-between align-items-center border border-secondary p-2 m-2";
    const label_classes = "text-start fw-bold fs-5 text-secondary";
    const input_classes = "form-control w-75";
    const select_classes = "form-select w-75";
    //write here all the potions of colors: here: text-info, text-primary, text-secondary, text-success, text-danger, text-warning, text-muted, text-light, text-dark
    const field_name_classes = "text-start fw-bold text-primary mb-4 fs-4";
    const field_classes = "col-12 col-lg-5 text-start border border-dark m-1 p-2";
    const fields_container_classes = "col-12 row d-flex justify-content-evenly align-items-start";

    const new_value_class = "text-warning";
    const build_input_filther = (label, text, type) => 
    {
        const filther = document.createElement('div');
        filther.className = filther_classes;
        const label_p = document.createElement('p');
        label_p.className = label_classes;
        label_p.textContent = text;
        filther.appendChild(label_p);

        const input = document.createElement('input');
        input.type = type;
        input.id = label;
        if (user && user[label] !== undefined)
        {
            input.value = (type === 'date') ? new Date(user[label]).toISOString().split('T')[0] : user[label];
        }
        input.addEventListener('input', () => 
            {
                let original_value = user[label];
                if (type === 'date')
                {
                    original_value = user[label] ? new Date(user[label]).toISOString().split('T')[0] : '';
                }
                if (input.value === '' || (user && input.value === original_value))
                {
                    label_p.classList.remove(new_value_class);
                }
                else
                {
                    label_p.classList.add(new_value_class);
                }
            });
        input.className = input_classes;
        filther.appendChild(input);
        return filther;
    };

    const build_select_filther = (label, text, options) => 
    {
        const filther = document.createElement('div');
        filther.className = filther_classes;
        const label_p = document.createElement('p');
        label_p.className = label_classes;
        label_p.textContent = text;
        filther.appendChild(label_p);

        const select = document.createElement('select');
        select.id = label;
        select.className = select_classes;
        options.forEach(option => {
            const option_element = document.createElement('option');
            option_element.value = option;
            option_element.textContent = option;
            select.appendChild(option_element);
        });
        if (user && user[label] && user[label] !== options[0] ) 
        {
            select.value = user[label];
        }
        select.addEventListener('change', () =>
        {
            if (select.value === options[0] || (user && select.value === user[label]))
            {
                label_p.classList.remove(new_value_class);
            }
            else
            {
                label_p.classList.add(new_value_class);
            }
        });
        filther.appendChild(select);
        return filther;
    }

 


    const fields_container = document.createElement('div');
    fields_container.className = fields_container_classes;
    filters_window_content.appendChild(fields_container);
    /* 
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        birthday: user.birthDate,
    */
    fields_container.appendChild(build_input_filther('email', "Email" , 'text'));
    fields_container.appendChild(build_input_filther('phone', "Phone" , 'text'));
    fields_container.appendChild(build_input_filther('fullName', "Full Name" , 'text'));
    fields_container.appendChild(build_input_filther('birthday', "Birth Date" , 'date'));
    fields_container.appendChild(build_input_filther('password', "Set New password" , 'password'));
    filters_window_content.appendChild(fields_container);

    const buttons_container = document.createElement('div');
    buttons_container.className = 'col-12 d-flex justify-content-evenly align-items-center';
    buttons_container.appendChild(cancel_button);
    buttons_container.appendChild(update_button);

    filters_window_content.appendChild(buttons_container);
    filters_window_overlay.appendChild(filters_window_content);
    document.body.appendChild(filters_window_overlay);

    // return the reference to the filters window
    return filters_window_overlay;
}

async function update_user(user)
{
    const form_data = get_filters_from_window(filters_window);
    let changes = {};
    const date_fields = ['birthday'];
    for (const key in form_data)
    {
        if (!(key in user))
        {
            continue;
        }
        
        let original_value;
        if (form_data[key] === "")
        {
            original_value = "";//if the value is empty, set the original value to empty
                                //if you left the input empty, you not change the value
            continue;
        }
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
    if(Object.keys(changes).length === 0)
    {
        close_filters_window();
        UI.ShowMessage("No changes to update");
        return;
    }
    const response = await Backend.updateUserById(token, user.id, changes);
    if(!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage("העדכון נכשל , שגיאת שרת: " + response.message);
        return;
    }
    if(!response.user)
    {
        close_filters_window();
        UI.ShowErrorMessage("עדכון המשתמש נכשל בגלל טעות בקבלת המשתמש.");
        return;
    }
    UI.ShowMessage("User updated successfully");
    current_target = response.user;
    view_user();
    close_filters_window();
}

function create_update_content_window(content) 
{
    if(!content || !(content instanceof ContentItem))
    {
        UI.ShowErrorMessage("No content selected");
        return null;
    }

    const filters_window_overlay = document.createElement('div');
    filters_window_overlay.className = ' position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75';
    filters_window_overlay.style.zIndex = '1050';

    const filters_window_content = document.createElement('div');
    filters_window_content.className = 'col-10 bg-dark bg-opacity-75 p-4 rounded shadow-lg text-center';
    filters_window_content.style.maxHeight = '90vh';
    filters_window_content.style.overflowY = 'auto';


    const title = document.createElement('h1');
    title.className = 'mb-3 text-danger fw-bold fs-1';
    title.textContent = 'Update Content';
    filters_window_content.appendChild(title);


    const cancel_button = document.createElement('button');
    cancel_button.className = 'btn btn-secondary btn-lg';
    cancel_button.textContent = 'Cancel';
    cancel_button.addEventListener('click', () => {
        close_filters_window();
    });
    //we not add it now because we want to add it to the bottom of the filters_window_content

    const update_button = document.createElement('button');
    update_button.className = 'btn btn-primary btn-lg';
    update_button.textContent = 'Update';
    update_button.addEventListener('click', () => {
        update_content(content);
    });
    add_filters_listener(update_button);
    //we not add it now because we want to add it to the bottom of the filters_window_content

    const filters_container = document.createElement('div');
    filters_container.className = 'col-12 text-start';
    filters_window_content.appendChild(filters_container);


    //=============== Build filters ===============
    const filther_classes = "col-12 d-flex justify-content-between align-items-center border border-secondary p-2 m-2";
    const label_classes = "text-start fw-bold fs-5 text-secondary";
    const input_classes = "form-control w-75";
    const select_classes = "form-select w-75";
    //write here all the potions of colors: here: text-info, text-primary, text-secondary, text-success, text-danger, text-warning, text-muted, text-light, text-dark
    const field_name_classes = "text-start fw-bold text-primary mb-4 fs-4";
    const field_classes = "col-12 col-lg-5 text-start border border-dark m-1 p-2";
    const fields_container_classes = "col-12 row d-flex justify-content-evenly align-items-start";

    const new_value_class = "text-warning";
    const build_input_filther = (label, text, type) => 
    {
        const filther = document.createElement('div');
        filther.className = filther_classes;
        const label_p = document.createElement('p');
        label_p.className = label_classes;
        label_p.textContent = text;
        filther.appendChild(label_p);

        const input = document.createElement('input');
        input.type = type;
        input.id = label;
        if (content && content[label] !== undefined)
        {
            if (Array.isArray(content[label]))
            {
                input.value = content[label].join(", ");
            }
            else
            {
                input.value = (type === 'date') ? new Date(content[label]).toISOString().split('T')[0] : content[label];
            }
        }
        input.addEventListener('input', () => 
            {
                let orginal_value = content[label];
                if (Array.isArray(orginal_value))
                {
                    orginal_value = orginal_value.join(", ");
                }
                else if (type === 'date')
                {
                    orginal_value = new Date(orginal_value).toISOString().split('T')[0];
                }
                if (input.value === '' || (content && input.value === orginal_value))
                {
                    label_p.classList.remove(new_value_class);
                }
                else
                {
                    label_p.classList.add(new_value_class);
                }
            });
        input.className = input_classes;
        filther.appendChild(input);
        return filther;
    };

    const build_select_filther = (label, text, options) => 
    {
        const filther = document.createElement('div');
        filther.className = filther_classes;
        const label_p = document.createElement('p');
        label_p.className = label_classes;
        label_p.textContent = text;
        filther.appendChild(label_p);

        const select = document.createElement('select');
        select.id = label;
        select.className = select_classes;
        options.forEach(option => {
            const option_element = document.createElement('option');
            option_element.value = option;
            option_element.textContent = option;
            select.appendChild(option_element);
        });
        if (content && content[label] && content[label] !== options[0] ) 
        {
            select.value = content[label];
        }
        select.addEventListener('change', () =>
        {
            if (select.value === options[0] || (content && select.value === content[label]))
            {
                label_p.classList.remove(new_value_class);
            }
            else
            {
                label_p.classList.add(new_value_class);
            }
        });
        filther.appendChild(select);
        return filther;
    }

 


    const fields_container = document.createElement('div');
    fields_container.className = fields_container_classes;
    filters_window_content.appendChild(fields_container);
    /* 
        id: content._id.toString(),
        title: content.title,
        description: content.description,
        cover_image_name: content.cover_image_name,
        type: content.type,
        categories: content.categories,
        release_date: content.release_date,
        age_limit: content.age_limit,
        likes: content.likes,
        videoUrl: content.videoUrl,
        createdAt: content.createdAt
    */
    fields_container.appendChild(build_input_filther('title', "Title" , 'text'));
    fields_container.appendChild(build_input_filther('description', "Description" , 'text'));
    fields_container.appendChild(build_input_filther('cover_image_name', "Cover Image Name" , 'text'));
    fields_container.appendChild(build_select_filther('type', "Type" , ['movie', 'series']));
    fields_container.appendChild(build_input_filther('categories', "Categories" , 'text'));
    fields_container.appendChild(build_input_filther('release_date', "Release Date" , 'date'));
    fields_container.appendChild(build_input_filther('age_limit', "Age Limit" , 'number'));
    fields_container.appendChild(build_input_filther('videoUrl', "Video URL" , 'text'));
    filters_window_content.appendChild(fields_container);

    const buttons_container = document.createElement('div');
    buttons_container.className = 'col-12 d-flex justify-content-evenly align-items-center';
    buttons_container.appendChild(cancel_button);
    buttons_container.appendChild(update_button);

    filters_window_content.appendChild(buttons_container);
    filters_window_overlay.appendChild(filters_window_content);
    document.body.appendChild(filters_window_overlay);

    // return the reference to the filters window
    return filters_window_overlay;
}

async function update_content(content)
{
    const form_data = get_filters_from_window(filters_window);
    let changes = {};
    const date_fields = ['release_date'];
    const array_fields = ['categories'];
    for (const key in form_data)
    {
        if (!(key in content)) continue;
        if (form_data[key] === "");
        {
            console.log("key is empty", key);
            continue;
        }
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
            changes[key] = form_data[key];
        }
    }
    for (const key in changes)
    {
        content[key] = changes[key];
    }

    if(changes.length === 0)
    {
        UI.ShowMessage("No changes to update");
        return;
    }

    const response = await Backend.updateContent(token, content.id, changes);
    if(!response.success)
    {
        close_filters_window();
        UI.ShowErrorMessage("העדכון נכשל , שגיאת שרת: " + response.message);
        return;
    }
    if(!response.content)
    {
        close_filters_window();
        UI.ShowErrorMessage("עדכון התוכן נכשל בגלל טעות בקבלת התוכן.");
        return;
    }
    UI.ShowMessage("Content updated successfully");
    current_target = response.content;
    view_content();
    close_filters_window();
}


function create_users_filters_window(filters) {
    const filters_window_overlay = document.createElement('div');
    filters_window_overlay.className = ' position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75';
    filters_window_overlay.style.zIndex = '1050';

    const filters_window_content = document.createElement('div');
    filters_window_content.className = 'col-10 bg-dark bg-opacity-75 p-4 rounded shadow-lg text-center';
    filters_window_content.style.maxHeight = '90vh';
    filters_window_content.style.overflowY = 'auto';


    const title = document.createElement('h1');
    title.className = 'mb-3 text-danger fw-bold fs-1';
    title.textContent = 'Users filters Setup';
    filters_window_content.appendChild(title);


    const cancel_button = document.createElement('button');
    cancel_button.className = 'btn btn-secondary btn-lg';
    cancel_button.textContent = 'Cancel';
    cancel_button.addEventListener('click', () => {
        close_filters_window();
    });
    //we not add it now because we want to add it to the bottom of the filters_window_content

    const search_button = document.createElement('button');
    search_button.className = 'btn btn-primary btn-lg';
    search_button.textContent = 'Search';
    search_button.addEventListener('click', () => {
        search_users_filters();
    });
    add_filters_listener(search_button);
    //we not add it now because we want to add it to the bottom of the filters_window_content

    const filters_container = document.createElement('div');
    filters_container.className = 'col-12 text-start';
    filters_window_content.appendChild(filters_container);


    //=============== Build filters ===============
    const filther_classes = "col-12 d-flex justify-content-between align-items-center border border-secondary p-2 m-2";
    const label_classes = "text-start fw-bold fs-5 text-secondary";
    const input_classes = "form-control w-75";
    const select_classes = "form-select w-75";
    //write here all the potions of colors: here: text-info, text-primary, text-secondary, text-success, text-danger, text-warning, text-muted, text-light, text-dark
    const field_name_classes = "text-start fw-bold text-primary mb-4 fs-4";
    const field_classes = "col-12 col-lg-5 text-start border border-dark m-1 p-2";
    const fields_container_classes = "col-12 row d-flex justify-content-evenly align-items-start";
    const have_value_class = "text-success";
    const new_value_class = "text-warning";
    const build_input_filther = (label, text, type) => 
    {
        const filther = document.createElement('div');
        filther.className = filther_classes;
        const label_p = document.createElement('p');
        label_p.className = label_classes;
        label_p.textContent = text;
        filther.appendChild(label_p);

        const input = document.createElement('input');
        input.type = type;
        input.id = label;
        if (filters && filters[label]) 
        {
            label_p.classList.add(have_value_class);
            input.value = filters[label];
        }
        input.addEventListener('input', () => 
            {
                if (input.value === '') 
                {
                    label_p.classList.remove(have_value_class, new_value_class);
                }
                else
                {
                    label_p.classList.add(new_value_class);
                }
            });
        input.className = input_classes;
        filther.appendChild(input);
        return filther;
    };

    const build_select_filther = (label, text, options) => 
    {
        const filther = document.createElement('div');
        filther.className = filther_classes;
        const label_p = document.createElement('p');
        label_p.className = label_classes;
        label_p.textContent = text;
        filther.appendChild(label_p);

        const select = document.createElement('select');
        select.id = label;
        select.className = select_classes;
        options.forEach(option => {
            const option_element = document.createElement('option');
            option_element.value = option;
            option_element.textContent = option;
            select.appendChild(option_element);
        });
        if (filters && filters[label] && filters[label] !== options[0] ) 
        {
            label_p.classList.add(have_value_class);
            //add listener to the select to clear the class when the select is empty
            
            select.value = filters[label];
        }
        select.addEventListener('change', () =>
            {
                if (select.value === options[0])
                {
                    label_p.classList.remove(have_value_class, new_value_class);
                }
                else
                {
                    label_p.classList.add(new_value_class);
                }
            });
        filther.appendChild(select);
        return filther;
    }

    const fullname_filters = 
    [
        build_input_filther('fullname_starts', 'Starts with', 'text'),
        build_input_filther('fullname_ends', 'Ends with', 'text'),
        build_input_filther('fullname_contains', 'Contains', 'text'),
    ];

    const email_filters = 
    [
        build_input_filther('email_starts', 'Starts with', 'text'),
        build_input_filther('email_ends', 'Ends with', 'text'),
        build_input_filther('email_contains', 'Contains', 'text'),
    ];

    const phone_filters = 
    [
        build_input_filther('phone_starts', 'Starts with', 'text'),
        build_input_filther('phone_ends', 'Ends with', 'text'),
        build_input_filther('phone_contains', 'Contains', 'text'),
    ];

    const birth_date_filters = 
    [
        build_input_filther('born_after', 'After', 'date'),
        build_input_filther('born_before', 'Before', 'date'),
    ];

    const join_date_filters = 
    [
        build_input_filther('joined_after', 'After', 'date'),
        build_input_filther('joined_before', 'Before', 'date'),
    ];

    const sort_filters = 
    [
        build_select_filther('sort', 'Sort', ['createdAt', 'birthDate', 'fullName', 'email']),
        build_select_filther('sortOrder', 'Sort Order', ['greater_to_smaller', 'smaller_to_greater']),
    ];

    const pagination_filters = 
    [
        build_input_filther('limit', 'Limit', 'number'),
        build_input_filther('skip', 'Skip', 'number'),
    ];

    const build_field = (field_name , field_filters) => 
    {
        const field = document.createElement('div');
        field.className = field_classes;
        const field_name_p = document.createElement('p');
        field_name_p.className = field_name_classes;
        field_name_p.textContent = field_name + ":";
        field.appendChild(field_name_p);
        field_filters.forEach(filther => {
            field.appendChild(filther);
        });
        return field;
    }


    const fields_container = document.createElement('div');
    fields_container.className = fields_container_classes;
    filters_window_content.appendChild(fields_container);
    fields_container.appendChild(build_field('Full Name', fullname_filters));
    fields_container.appendChild(build_field('Email', email_filters));
    fields_container.appendChild(build_field('Phone', phone_filters));
    fields_container.appendChild(build_field('Birth Date', birth_date_filters));
    fields_container.appendChild(build_field('Join Date', join_date_filters));
    fields_container.appendChild(build_field('Sort', sort_filters));
    fields_container.appendChild(build_field('Pagination', pagination_filters));
    filters_window_content.appendChild(fields_container);

    const buttons_container = document.createElement('div');
    buttons_container.className = 'col-12 d-flex justify-content-evenly align-items-center';
    buttons_container.appendChild(cancel_button);
    buttons_container.appendChild(search_button);

    filters_window_content.appendChild(buttons_container);
    filters_window_overlay.appendChild(filters_window_content);
    document.body.appendChild(filters_window_overlay);

    // return the reference to the filters window
    return filters_window_overlay;
}

function create_contents_filters_window(filters)
{
    const filters_window_overlay = document.createElement('div');
    filters_window_overlay.className = ' position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-75';
    filters_window_overlay.style.zIndex = '1050';

    const filters_window_content = document.createElement('div');
    filters_window_content.className = 'col-10 bg-dark bg-opacity-75 p-4 rounded shadow-lg text-center';
    filters_window_content.style.maxHeight = '90vh';
    filters_window_content.style.overflowY = 'auto';


    const title = document.createElement('h1');
    title.className = 'mb-3 text-danger fw-bold fs-1';
    title.textContent = 'Contents filters Setup';
    filters_window_content.appendChild(title);


    const cancel_button = document.createElement('button');
    cancel_button.className = 'btn btn-secondary btn-lg';
    cancel_button.textContent = 'Cancel';
    cancel_button.addEventListener('click', () =>
    {
        close_filters_window();
    });
    //we not add it now because we want to add it to the bottom of the filters_window_content

    const search_button = document.createElement('button');
    search_button.className = 'btn btn-primary btn-lg';
    search_button.textContent = 'Search';
    search_button.addEventListener('click', () =>
    {
        search_contents_filters();
    });
    add_filters_listener(search_button);
    //we not add it now because we want to add it to the bottom of the filters_window_content

    const filters_container = document.createElement('div');
    filters_container.className = 'col-12 text-start';
    filters_window_content.appendChild(filters_container);


    //=============== Build filters ===============
    const filther_classes = "col-12 d-flex justify-content-between align-items-center border border-secondary p-2 m-2";
    const label_classes = "text-start fw-bold fs-5 text-secondary";
    const input_classes = "form-control w-75";
    const select_classes = "form-select w-75";
    const field_name_classes = "text-start fw-bold text-primary mb-4 fs-4";
    const field_classes = "col-12 col-lg-5 text-start border border-dark m-1 p-2";
    const fields_container_classes = "col-12 row d-flex justify-content-evenly align-items-start";
    const have_value_class = "text-success";
    const new_value_class = "text-warning";
    const build_input_filther = (label, text, type) =>
    {
        const filther = document.createElement('div');
        filther.className = filther_classes;
        const label_p = document.createElement('p');
        label_p.className = label_classes;
        label_p.textContent = text;
        filther.appendChild(label_p);

        const input = document.createElement('input');
        input.type = type;
        input.id = label;
        if (filters && filters[label])
        {
            label_p.classList.add(have_value_class);
            input.value = filters[label];
        }
        input.addEventListener('input', () =>
        {
            if (input.value === '')
            {
                label_p.classList.remove(have_value_class, new_value_class);
            }
            else
            {
                label_p.classList.add(new_value_class);
            }
        });
        input.className = input_classes;
        filther.appendChild(input);
        return filther;
    };

    const build_select_filther = (label, text, options) =>
    {
        const filther = document.createElement('div');
        filther.className = filther_classes;
        const label_p = document.createElement('p');
        label_p.className = label_classes;
        label_p.textContent = text;
        filther.appendChild(label_p);

        const select = document.createElement('select');
        select.id = label;
        select.className = select_classes;
        options.forEach(option =>
        {
            const option_element = document.createElement('option');
            option_element.value = option;
            option_element.textContent = option;
            select.appendChild(option_element);
        });
        if (filters && filters[label] && filters[label] !== options[0] )
        {
            label_p.classList.add(have_value_class);
            select.value = filters[label];
        }
        select.addEventListener('change', () =>
        {
            if (select.value === options[0])
            {
                label_p.classList.remove(have_value_class, new_value_class);
            }
            else
            {
                label_p.classList.add(new_value_class);
            }
        });
        filther.appendChild(select);
        return filther;
    }

    const title_filters =
    [
        build_input_filther('title_starts', 'Starts with', 'text'),
        build_input_filther('title_ends', 'Ends with', 'text'),
        build_input_filther('title_contains', 'Contains', 'text'),
    ];

    const category_filters =
    [
        build_input_filther('exact_category', 'Exact', 'text'),
        build_input_filther('contain_category', 'Contains', 'text'),
        build_input_filther('exclude_category', 'Exclude', 'text'),
    ];

    const type_filters =
    [
        build_select_filther('type', 'Type', ['all', 'series' , 'movie']),
    ];

    const release_date_filters =
    [
        build_input_filther('released_after', 'After', 'date'),
        build_input_filther('released_before', 'Before', 'date'),
    ];

    const age_limit_filters =
    [
        build_input_filther('min_age_limit', 'Min', 'number'),
        build_input_filther('max_age_limit', 'Max', 'number'),
    ];

    const likes_filters =
    [
        build_input_filther('min_likes', 'Minimum likes', 'number'),
    ];

    const sort_filters =
    [
        build_select_filther('sort', 'Sort', ['release_date', 'likes', 'title', 'age_limit', 'createdAt']),
        build_select_filther('sortOrder', 'Sort Order', ['greater_to_smaller', 'smaller_to_greater']),
    ];

    const pagination_filters =
    [
        build_input_filther('limit', 'Limit', 'number'),
        build_input_filther('skip', 'Skip', 'number'),
    ];

    const build_field = (field_name, field_filters) =>
    {
        const field = document.createElement('div');
        field.className = field_classes;
        const field_name_p = document.createElement('p');
        field_name_p.className = field_name_classes;
        field_name_p.textContent = field_name + ":";
        field.appendChild(field_name_p);
        field_filters.forEach(filther =>
        {
            field.appendChild(filther);
        });
        return field;
    }


    const fields_container = document.createElement('div');
    fields_container.className = fields_container_classes;
    filters_window_content.appendChild(fields_container);
    fields_container.appendChild(build_field('Title', title_filters));
    fields_container.appendChild(build_field('Categories (comma separated)', category_filters));
    fields_container.appendChild(build_field('Type', type_filters));
    fields_container.appendChild(build_field('Release Date', release_date_filters));
    fields_container.appendChild(build_field('Age Limit', age_limit_filters));
    fields_container.appendChild(build_field('Likes', likes_filters));
    fields_container.appendChild(build_field('Sort', sort_filters));
    fields_container.appendChild(build_field('Pagination', pagination_filters));
    filters_window_content.appendChild(fields_container);

    const buttons_container = document.createElement('div');
    buttons_container.className = 'col-12 d-flex justify-content-evenly align-items-center';
    buttons_container.appendChild(cancel_button);
    buttons_container.appendChild(search_button);

    filters_window_content.appendChild(buttons_container);
    filters_window_overlay.appendChild(filters_window_content);
    document.body.appendChild(filters_window_overlay);

    // return the reference to the filters window
    return filters_window_overlay;
}
//=============== Main Renderer ===============
function main_renderer()
{
    
    //UI.ClearMessage();
    switch (current_mode)
    {
        case mode.empty:
        {
            UI.ShowMessage("Please select a mode");
            selection_container.style.transform = "scale(1, 0)";
            selection_counter.style.opacity = "0";
            view_container.style.transform = "scale(1, 0)";
            controll_container.style.opacity = "0";
            setTimeout(() => {
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
    
    // allow the browser to render the display: block before running the transform
            requestAnimationFrame(() => {
                selection_container.style.transform = "scale(1, 1)";
                view_container.style.transform = "scale(1, 1)";
                controll_container.style.opacity = "1";
                selection_counter.style.opacity = "1";
            });
            render_controll_container([
                {name: "Search", function: () => filters_window = create_users_filters_window(users_filters)},
                {name: "Update", primary: true , function: () => filters_window = create_update_user_window(current_target)},
                {name: "Delete", function: () => {UI.ShowMessage("Not implemented")}},
                {name: "My User", function: () => {current_target = active_user; view_user()}},
                {name: "test", function: () => {UI.ShowMessage("Not implemented")}},
                {name: "test", function: () => {UI.ShowMessage("Not implemented")}},
                {name: "test", function: () => {UI.ShowMessage("Not implemented")}},
            ]);
            rander_selection_container_to_users();
            view_user();
            break;
        }
        case mode.contents:
        {
            //for debug
            /*     * @param {string} id - Unique identifier as returned by the backend (opaque, do not assume a numeric format).
     * @param {string} name - Content title.
     * @param {string} [cover_imageName] - Cover image filename.
     * @param {number} [likes=0]
     * @param {string} [type] - "movie" | "series".
     * @param {Array<string>} [categories=[]]
     * @param {string} [description]
     * @param {number} [age_limit=0]
     * @param {string} [videoUrl]
     * @param {string} [release_date]
     * @param {string} [createdAt]*/
    current_target = 
    {

        id: "abcd1234",
        title: "Black Rabbit",
        cover_image_name: "Black_Rabbit.jpg",
        likes: 100,
        type: "movie",
        categories: ["Action", "Adventure"],
        description: "A movie about a man who goes on an adventure",
        age_limit: 18,
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        release_date: new Date("2021-01-01"),
        createdAt: new Date("2021-01-01")
    };
    current_target = ContentItem.fromJSON(current_target);
            //make them regualer size
            selection_container.style.display = "block";
            view_container.style.display = "block";
            controll_container.style.display = "block";
    
            // allow the browser to render the display: block before running the transform
            requestAnimationFrame(() => {
                selection_container.style.transform = "scale(1, 1)";
                view_container.style.transform = "scale(1, 1)";
                controll_container.style.opacity = "1";
            });
            render_controll_container([
                {name: "set up filters", function: () => filters_window = create_contents_filters_window(contents_filters)},
                {name: "update content", function: () => filters_window = create_update_content_window(current_target)},
            ]);
            view_content();
            break;
        }
    }
    rander_mode_selector();
}

//=============== Error Handling ===============
if (!mode_selector_container)throw new Error("mode_selector_container not found");
if (!selection_counter)throw new Error("selection_counter not found");
if (!controll_container)throw new Error("controll_container not found");
if (!selection_container)throw new Error("selection_container not found");
if (!view_container)throw new Error("view_container not found");
if (!msg_box)throw new Error("msg_box not found");
//for test set current target to fake user info
main_renderer();
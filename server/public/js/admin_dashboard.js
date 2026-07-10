//i want to create a js file for the admin dashbord page
import * as UI from "./ui-utils.js";
const mode_selector_container = document.getElementById("mode_selector_container");//to be able to switch between modes
const controll_container = document.getElementById("controll_container");//to show information
const selection_container = document.getElementById("selection_container");//to show information
const view_container = document.getElementById("view_container");//the place to rander.
const msg_box = document.getElementById("msg_box");//to show messages
let filters_window = null;
const mode = Object.freeze({
    "empty": 0,
    "users": 1,
    "contents": 2
});

const numbers_to_modes = Object.fromEntries(Object.entries(mode).map(([key, value]) => [value, key]));
let current_mode = mode.empty;
let current_target = null;

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

function view_content()
{
    if (!current_target)
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
    image_element.src = `/assets/covers/${current_target.cover_imageName}`;
    image_element.className = 'img-fluid';
    const contentHtml = `
    <div class="w-100 p-4">
        <h1 class="fw-bold mb-4">${current_target.name}</h1>
        ${image_element.outerHTML}
        ${renderField("ID", current_target.id)}
        ${renderField("Cover Image Name", current_target.cover_imageName)}
        ${renderField("Likes", current_target.likes)}
        ${renderField("Type", current_target.type)}
        ${renderField("Categories", current_target.categories.join(", "))}
        ${renderField("Description", current_target.description)}
        ${renderField("Age Limit", current_target.age_limit)}
        ${renderField("Video URL", current_target.videoUrl)}
        ${renderField("Release Date", current_target.release_date.toLocaleDateString())}
        ${renderField("Created At", current_target.createdAt.toLocaleDateString())}
    </div>
    `;
    //i want to show the cover image in the background of the view_container
    view_container.innerHTML = contentHtml;

}

function view_user()
{
    if (!current_target)
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
        <h1 class="fw-bold mb-4">${current_target.fullName}</h1>
        ${renderField("ID", current_target.id)}
        ${renderField("Email", current_target.email)}
        ${renderField("Phone", current_target.phone)}
        ${renderField("Birthday", current_target.birthday.toLocaleDateString())}
        ${renderField("Created At", current_target.createdAt.toLocaleDateString())}
    </div>
    `;


    view_container.innerHTML = userHtml;
}

function renderField(label, value, seperator = ':', labelClass = 'text-danger', valueClass = 'text-white')
{
    return `
        <div class="label_item row border border-white rounded-pill p-2 col-12 d-flex flex-row justify-content-evenly align-items-center m-2">
            <div class="col-4 col-md-5 text-center ${labelClass} fw-bold fs-4">${label}</div>
            <div class="col-1 col-md-1 text-center text-warning fw-bold fs-4">${seperator}</div>
            <div class="col-7 col-md-6 text-center ${valueClass} fs-5" dir="ltr">${value}</div>
        </div>
    `;
}

function render_controll_container(buttons)
{
    //add all the buttons to a new html element and then assing that elemnt to be the controll innerhtml
    let buttons_html = document.createElement('div');
    
    buttons.forEach(button => 
    {
        const btn = document.createElement("button");
        const btn_type = (button.type === "primary") ? "btn-primary" : "btn-secondary";
        btn.className = `btn btn-group btn-lg ${btn_type} rounded-pill`;
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
    Object.entries(mode).forEach(([key, value]) => 
    {
        const btn = document.createElement("button");
        btn.className = "btn btn-group btn-lg btn-outline-light rounded-pill";
        if (value === current_mode) btn.classList.add("active");
        btn.textContent = key.toUpperCase() + " Mode";
        // add direct listener to the DOM Element
        btn.addEventListener("click", () => switch_mode(value));
        mode_selector_container.appendChild(btn);
    });
}

function search_users_filters() 
{
    users_filters = get_filters_from_window(filters_window);
    close_filters_window();
}
function search_contents_filters() 
{
    contents_filters = get_filters_from_window(filters_window);
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
            //add listener to the input to clear the class when the input is empty
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
    rander_mode_selector();
    UI.ClearMessage();
    switch (current_mode)
    {
        case mode.empty:
        {
            UI.ShowMessage("Please select a mode");
            selection_container.style.transform = "scale(1, 0)";
            view_container.style.transform = "scale(1, 0)";
            controll_container.style.opacity = "0";
            setTimeout(() => {
                selection_container.style.display = "none";
                view_container.style.display = "none";
                controll_container.style.display = "none";
            }, 300);
            break;
        }
        case mode.users:
        {
            //for debug
            current_target = {
                id: "abcd1234",
                fullName: "John Doe",
                email: "john.doe@example.com",
                phone: "0521234567",
                birthday: new Date("1990-01-01"),
                createdAt: new Date("2021-01-01")
            };

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
                {name: "set up filters", function: () => filters_window = create_users_filters_window(users_filters)},
            ]);
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
        name: "Black Rabbit",
        cover_imageName: "Black_Rabbit.jpg",
        likes: 100,
        type: "movie",
        categories: ["Action", "Adventure"],
        description: "A movie about a man who goes on an adventure",
        age_limit: 18,
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        release_date: new Date("2021-01-01"),
        createdAt: new Date("2021-01-01")
    };
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
            ]);
            view_content();
            break;
        }
    }
}

//=============== Error Handling ===============
if (!mode_selector_container)throw new Error("mode_selector_container not found");
if (!controll_container)throw new Error("controll_container not found");
if (!selection_container)throw new Error("selection_container not found");
if (!view_container)throw new Error("view_container not found");
if (!msg_box)throw new Error("msg_box not found");
//for test set current target to fake user info
current_target = {
    id: "abcd1234",
    fullName: "John Doe",
    email: "john.doe@example.com",
    phone: "0521234567",
    birthday: new Date("1990-01-01"),
    createdAt: new Date("2021-01-01")
};
main_renderer();
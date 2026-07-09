//i want to create a js file for the admin dashbord page
import * as UI from "./ui-utils.js";
const mode_selector_container = document.getElementById("mode_selector_container");//to be able to switch between modes
const controll_container = document.getElementById("controll_container");//to show information
const selection_container = document.getElementById("selection_container");//to show information
const view_container = document.getElementById("view_container");//the place to rander.
const msg_box = document.getElementById("msg_box");//to show messages

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
        <div class="lable_item row border border-white rounded-pill p-2 col-12 d-flex flex-row justify-content-evenly align-items-center m-2">
            <div class="col-4 col-md-5 text-center ${labelClass} fw-bold fs-4">${label}</div>
            <div class="col-1 col-md-1 text-center text-warning fw-bold fs-4">${seperator}</div>
            <div class="col-7 col-md-6 text-center ${valueClass} fs-5" dir="ltr">${value}</div>
        </div>
    `;
}

function render_controll_container(buttons)
{
    //evry button is have this fields: name, function
    buttons.forEach(button => 
    {
        const btn = document.createElement("button");
        btn.className = "btn btn-group btn-lg btn-outline-light rounded-pill";
        btn.textContent = button.name;
        btn.addEventListener("click", button.function); 
        controll_container.appendChild(btn);
    });
}



//=============== Mode Selector Renderer ===============
function rander_mode_selector()
{
    clear_mode_selector_container();
    clear_controll_container();
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
            UI.ShowMessage("Users Mode");
            render_controll_container([
                {name: "View User1", function: undefined},
                {name: "View User2", function: undefined},
                {name: "View User3", function: undefined},
            ]);
            view_user();
            break;
        }
        case mode.contents:
        {
            UI.ShowMessage("Contents Mode");
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
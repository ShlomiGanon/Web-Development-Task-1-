import * as UI from './ui-utils.js';
import { Profile } from './BACKEND_API/backend-interface.js';

//variables
let isEditing = false;
let HasChanged = false;
const profiles_area = document.getElementById('profiles');
const manage_profile_button = document.getElementById('manage-profile-button');
const add_profile_button = document.getElementById('add-profile-button');
const remove_profile_button = document.getElementById('remove-profile-button');

//profiles array
const profiles = 
[
    new Profile(1, 'Profile 1', 'profile1.png'),
    new Profile(2, 'Profile 2', 'profile2.png'),
    new Profile(3, 'Profile 3', 'profile3.png'),
    //new Profile(4, 'Profile 4', 'profile4.png'),
    //new Profile(5, 'Profile 5', 'profile5.png')
];


//show edit action buttons (add and remove profile buttons)
function showEditActionButtons() 
{
    add_profile_button.disabled = false;
    add_profile_button.style.visibility = "visible";
    add_profile_button.style.opacity = 1;

    remove_profile_button.disabled = false;
    remove_profile_button.style.visibility = "visible";
    remove_profile_button.style.opacity = 1;
}

//hide edit action buttons (add and remove profile buttons)
function hideEditActionButtons() 
{
    add_profile_button.disabled = true;
    add_profile_button.style.visibility = "hidden";
    add_profile_button.style.opacity = 0;

    remove_profile_button.disabled = true;
    remove_profile_button.style.visibility = "hidden";
    remove_profile_button.style.opacity = 0;
}

//attach input listeners to the profile input fields
//when the user starts typing, change the button text to "Save Changes" and hide the add and remove profile buttons
function attachInputListeners() 
{
    const inputs = document.querySelectorAll('.profile_input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            manage_profile_button.innerText = "Save Changes";
            hideEditActionButtons();
            HasChanged = true;
        });
    });
}

function ManageProfiles_OnClick()
{
    if (isEditing) 
    {
        if (HasChanged) 
        {
            saveProfiles();
            HasChanged = false;
            UI.ShowMessage("Profiles saved successfully");
        }
        else
        {
            UI.ShowMessage("No changes to save");
        }
    }
    isEditing = !isEditing;
    renderProfiles(isEditing ? 'input' : 'div');
    manage_profile_button.innerText = isEditing ? "go back" : "Manage Profiles";
    isEditing ? showEditActionButtons() : hideEditActionButtons();
}

//save profiles - save the profiles names to the profiles array after editing
function saveProfiles()
{
    profiles.forEach(profile => 
        {
            profile.name = document.getElementById(`profile_input_${profile.id}`).value;
        }
    );
}


// UI Helper: Converts a pure Profile object into HTML string
function renderProfileComponent(profile, tag_name = 'div') 
{
    if (tag_name === 'input') 
    {
        return `
            <div>
                <div class="profile" id="profile${profile.id}" style="cursor: pointer;">
                    <div class="profile_image">
                        <img src="../assets/${profile.imageName}" alt="${profile.name}" class="img-fluid border border-3 border-dark">
                    </div>
                </div>
                <input id="profile_input_${profile.id}" autocomplete="off" type="text" class="profile_input mt-3 text-secondary text-center" value="${profile.name}">
            </div>
        `;
    }
    else
    {
        return `
            <div class="profile" id="profile${profile.id}" style="cursor: pointer;">
                <div class="profile_image">
                    <img src="../assets/${profile.imageName}" alt="${profile.name}" class="img-fluid border border-3 border-dark">
                </div>
                <div class="profile_name mt-3 text-secondary text-center">
                    ${profile.name}
                </div>
            </div>
        `;
    }
}

function renderProfiles(tag_name = 'div') 
{
    let allProfilesHTML = "";
    profiles.forEach(profile => 
    {
        // We pass the pure data object into our UI component generator
        allProfilesHTML += renderProfileComponent(profile, tag_name);
    });
    profiles_area.innerHTML = allProfilesHTML;
    attachInputListeners();
}

//---------------------------- MAIN ----------------------------------------

renderProfiles();
manage_profile_button.addEventListener('click', ManageProfiles_OnClick);
add_profile_button.addEventListener('click', AddProfile_OnClick);
remove_profile_button.addEventListener('click', RemoveProfile_OnClick);

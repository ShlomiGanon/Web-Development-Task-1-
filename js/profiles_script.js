import * as UI from './ui-utils.js';


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
//render profiles - render the profiles to the profiles area
function renderProfiles(tag_name = 'div')
{
    let allProfilesHTML = "";
    profiles.forEach(profile => 
        {
            allProfilesHTML += profile.render(tag_name);
        }
    );
    profiles_area.innerHTML = allProfilesHTML;
    attachInputListeners();
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


//profile class
class Profile 
{
    constructor(id, name, imageName) 
    {
        this.id = id;
        this.name = name;
        this.imageName = imageName;
    }

    render(tag_name = 'div') 
    {
        // CASE 1: Edit Mode
        // Structure requires the input to be outside the 'profile' container to prevent 
        // style conflicts and ensure a smooth focus/editing experience.
        if (tag_name === 'input') 
        {
            return `
                <div>
                <div class="profile" id="profile${this.id}" style="cursor: pointer;">
                    <div class="profile_image">
                        <img src="../assets/${this.imageName}" alt="${this.name}" class="img-fluid border border-3 border-dark">
                    </div>
                </div>
                    <input id="profile_input_${this.id}" autocomplete="off" type="text" class="profile_input mt-3 text-secondary text-center" value="${this.name}">
                </div>
            `;
        } 
        // CASE 2: Display Mode
        // Standard Netflix-style profile card where the name is nested within 
        // the clickable profile area for a consistent hover effect.
        else 
        {
            return `
                <div class="profile" id="profile${this.id}" style="cursor: pointer;">
                    <div class="profile_image">
                        <img src="../assets/${this.imageName}" alt="${this.name}" class="img-fluid border border-3 border-dark">
                    </div>
                    <div class="profile_name mt-3 text-secondary text-center">
                        ${this.name}
                    </div>
                </div>
            `;
        }
    }
}

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


renderProfiles();
manage_profile_button.addEventListener('click', ManageProfiles_OnClick);
add_profile_button.addEventListener('click', AddProfile_OnClick);
remove_profile_button.addEventListener('click', RemoveProfile_OnClick);

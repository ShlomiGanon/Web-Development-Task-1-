// Admin dashboard: browse/search/manage users, content (+episodes), and reviews, plus stats.

import { UserInfo, ContentItem, Review } from "./api/models.js";
import { Backend } from "./constants.js";
import { ClientSessionManager } from "./core/session.js";
import
{
    escapeHtml, coverUrl, profileImageUrl, formatCategories, renderField, renderNavbar,
    renderWideCard, renderEmptyState,
    lockUi, goToLink, showMessage, showErrorMessage, clearMessage, isUiLocked, withUiLock,
    isOk, buildChangedFields, confirmAndRemove, failInModal, infoInModal,
    createModalShell, createButtonRow, buildEditInputField, buildEditSelectField,
    createFiltersModal, getFormValuesFromModal, getSearchFiltersFromModal,
    openModal, closeActiveModal, getActiveModal,
    createUpdateUserModal, createConfirmationModal,
    FIELD_ITEM_CLASSES, LABEL_CLASSES, INPUT_CLASSES, FIELDS_CONTAINER_CLASSES
} from "./ui.js";
// D3.js loaded as an ES module from CDN; no extra <script> tag needed.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

//=============== Session / auth bootstrap ===============
// Each check can redirect away and stops the rest of the bootstrap immediately.
function redirectToIndex(pressedButton = null)
{
    lockUi(pressedButton);
    goToLink("/");
}

async function initAdminSession()
{
    const sessionToken = ClientSessionManager.getSessionToken();
    if (!sessionToken)
    {
        redirectToIndex();
        return null;
    }

    const userResponse = await Backend.fetchActiveUserInfo(sessionToken);
    if (!userResponse || !userResponse.success || !userResponse.user)
    {
        redirectToIndex();
        return null;
    }

    const user = userResponse.user;
    if (!user.permission_level)
    {
        redirectToIndex();
        return null;
    }

    return { sessionToken, user };
}

const adminSession = await initAdminSession();
if (!adminSession)
{
    // Already navigating away; stop the rest of this module from running mid-flight.
    throw new Error("Not authorized for the admin dashboard - redirecting.");
}

const token = adminSession.sessionToken;
let activeUser = adminSession.user;
let currentTarget = null;

//=============== Permission levels ===============
const PERMISSION_LEVEL =
{
    SUPER_ADMIN: 2,
    ADMIN: 1,
    USER: 0
};
// Reverse lookup (2 -> "SUPER_ADMIN") for human-readable dropdown labels.
const permissionLookup = Object.fromEntries(
    Object.entries(PERMISSION_LEVEL).map(([key, value]) => [value, key])
);

//=============== DOM references ===============
const modeSelectorContainer = document.getElementById("mode_selector_container");
const controlContainer = document.getElementById("controll_container");
const selectionContainer = document.getElementById("selection_container");
const selectionCounter = document.getElementById("selection_counter");
const viewContainer = document.getElementById("view_container");
const msgBox = document.getElementById("msg_box");

const mode = Object.freeze({
    "users": 0,
    "contents": 1,
    "reviews": 2
});
// Reverse lookup (1 -> "users") for mode-selector button labels.
const numberToMode = Object.fromEntries(Object.entries(mode).map(([key, value]) => [value, key]));
let currentMode = mode.users;

let users = [];
let contents = [];
let reviews = [];
let usersFilters = {};
let contentsFilters = {};
let reviewsFilters = {};

// Currently-viewed series' episodes grouped by season (seasons[0] = season 1).
let currentTargetEpisodes = null;

//=============== Clearing containers ===============
function clearSelectionContainer()
{
    selectionContainer.innerHTML = "";
}
function clearViewContainer()
{
    viewContainer.innerHTML = "";
}
function clearControlContainer()
{
    controlContainer.innerHTML = "";
}

function switchMode(newMode)
{
    currentMode = newMode;
    mainRenderer();
}

//=============== Detail view renderers ===============
async function viewContent()
{
    if (!currentTarget || !(currentTarget instanceof ContentItem))
    {
        viewContainer.innerHTML = `
        <h1>No content selected</h1>
        <p>Please select a content from the list</p>
        `;
        return;
    }

    // Re-fetch by ID for extra fields (like imdb_rating) the list view lacks.
    const response = await Backend.getContentByID(currentTarget.id);
    if (!response.success || !response.content)
    {
        viewContainer.innerHTML = `
        <h1>Failed to get content</h1>
        <p>Please try again</p>
        <p>${escapeHtml(response.message)}</p>
        `;
        console.log(response);
        return;
    }
    currentTarget = response.content;

    const imageElement = document.createElement('img');
    imageElement.src = coverUrl(escapeHtml(currentTarget.cover_image_name));
    imageElement.className = 'img-fluid';
    imageElement.style.width = '300px';
    imageElement.style.maxWidth = '100%';
    imageElement.style.height = '450px';
    imageElement.style.objectFit = 'contain';

    // videoUrl lives on Episodes, not content; average_rating/review_count are read-only.
    const contentHtml = `
    <div class="w-100 p-4">
        <h1 class="fw-bold mb-4">${escapeHtml(currentTarget.title)}</h1>
        ${imageElement.outerHTML}
        ${renderField("ID", escapeHtml(currentTarget.id))}
        ${renderField("Cover Image Name", escapeHtml(currentTarget.cover_image_name))}
        ${renderField("Likes", escapeHtml(currentTarget.likes))}
        ${renderField("Type", escapeHtml(currentTarget.type))}
        ${renderField("Categories", escapeHtml(formatCategories(currentTarget.categories)))}
        ${renderField("Description", escapeHtml(currentTarget.description))}
        ${renderField("Age Limit", escapeHtml(currentTarget.age_limit))}
        ${renderField("Average Rating", escapeHtml(currentTarget.average_rating))}
        ${renderField("Review Count", escapeHtml(currentTarget.review_count))}
        ${renderField("Release Date", escapeHtml(currentTarget.release_date.toLocaleDateString()))}
        ${renderField("Created At", escapeHtml(currentTarget.createdAt.toLocaleDateString()))}
        ${renderField("IMDB Rating", escapeHtml(currentTarget.imdb_rating))}
    </div>
    `;
    viewContainer.innerHTML = contentHtml;
    await renderEpisodesSection(currentTarget);
    renderModeSelector();
}

async function viewUser()
{
    if (!currentTarget || !(currentTarget instanceof UserInfo))
    {
        viewContainer.innerHTML = `
        <h1>No user selected</h1>
        <p>Please select a user from the list</p>
        `;
        return;
    }

    // Ban status and session count are separate admin-only lookups, fetched fresh.
    const [banResponse, tokensResponse] = await Promise.all([
        Backend.isUserBanned(token, currentTarget.id),
        Backend.getUserTokensCount(token, currentTarget.id)
    ]);

    const isBanned = banResponse.success ? banResponse.is_banned : undefined;
    const banStatusText = banResponse.success
        ? (isBanned ? "Banned" : "Not banned")
        : "Unknown (failed to load)";
    const banValueClass = isBanned ? "text-danger fw-bold" : "text-white";

    const tokensCountText = tokensResponse.success
        ? String(tokensResponse.tokens_count)
        : "Unknown (failed to load)";

    const userHtml = `
    <div class="w-100 p-4">
        <h1 class="fw-bold mb-4">${escapeHtml(currentTarget.fullName)}</h1>
        ${renderField("ID", escapeHtml(currentTarget.id))}
        ${renderField("Email", escapeHtml(currentTarget.email))}
        ${renderField("Phone", escapeHtml(currentTarget.phone))}
        ${renderField("Birthday", escapeHtml(currentTarget.birthday.toLocaleDateString()))}
        ${renderField("Created At", escapeHtml(currentTarget.createdAt.toLocaleDateString()))}
        ${renderField("Permission Level", escapeHtml(currentTarget.permission_level))}
        ${renderField("Ban Status", escapeHtml(banStatusText), ':', 'text-danger', banValueClass)}
        ${renderField("Active Sessions", escapeHtml(tokensCountText))}
    </div>
    `;
    viewContainer.innerHTML = userHtml;
    renderModeSelector();
}

function viewReview()
{
    if (!currentTarget || !(currentTarget instanceof Review))
    {
        viewContainer.innerHTML = `
        <h1>No review selected</h1>
        <p>Please select a review from the list</p>
        `;
        return;
    }

    const reviewHtml = `
    <div class="w-100 p-4">
        <h1 class="fw-bold mb-4">Review - ${escapeHtml(currentTarget.rating)}/10</h1>
        ${renderField("ID", escapeHtml(currentTarget.id))}
        ${renderField("Content ID", escapeHtml(currentTarget.contentId))}
        ${renderField("Episode ID", escapeHtml(currentTarget.episodeId))}
        ${renderField("Profile ID", escapeHtml(currentTarget.profileId))}
        ${renderField("Rating", escapeHtml(currentTarget.rating))}
        ${renderField("Comment", escapeHtml(currentTarget.comment))}
    </div>
    `;
    viewContainer.innerHTML = reviewHtml;
    renderModeSelector();
}

function renderControlContainer(buttons)
{
    const row = createButtonRow(
        buttons.map(button => ({
            text: button.name,
            className: `btn btn-group btn-lg ${button.primary ? "btn-primary" : "btn-secondary"} rounded-pill mx-2`,
            onClick: button.function
        })),
        { containerClass: "d-flex justify-content-evenly align-items-center w-100" }
    );
    controlContainer.replaceChildren(row);
}

// Reuses the shared navbar as the admin mode switcher (Back to profiles + Users/Content/Reviews).
function renderModeSelector()
{
    // lastMode highlights the tab the viewed item belongs to, independent of currentMode.
    let lastMode;
    if (currentTarget instanceof UserInfo) lastMode = mode.users;
    else if (currentTarget instanceof ContentItem) lastMode = mode.contents;
    else if (currentTarget instanceof Review) lastMode = mode.reviews;
    else lastMode = undefined;

    const items = [
        {
            id: 'admin_back_link',
            label: 'Back to profiles',
            href: '#',
            onClick: () =>
            {
                if (isUiLocked) return;
                lockUi();
                showMessage("Redirecting to profiles...");
                goToLink("/html/profiles.html");
            }
        }
    ];

    Object.entries(mode).forEach(([key, value]) =>
    {
        items.push({
            id: `admin_mode_${key}`,
            label: key.toUpperCase() + " Mode",
            href: '#',
            active: value === currentMode,
            highlight: value === lastMode,
            onClick: () => switchMode(value)
        });
    });

    renderNavbar(modeSelectorContainer, { items, fixed: false, distributeItems: true });
}

//=============== Selection list renderers ===============
// Identical wide Netflix rows via renderWideCard; clicks are handled by delegation below.

function handleSelectionClick(event)
{
    const actionElement = event.target.closest('[data-action="select"]');
    if (!actionElement || isUiLocked) return;

    const id = actionElement.dataset.contentId;
    if (!id) return;

    withUiLock(null, () =>
    {
        switch (currentMode)
        {
            case mode.users:
                currentTarget = users.find(user => user.id === id);
                return viewUser();
            case mode.contents:
                currentTarget = contents.find(content => content.id === id);
                return viewContent();
            case mode.reviews:
                currentTarget = reviews.find(review => review.id === id);
                return viewReview();
        }
    });
}

function renderUsersSelection()
{
    selectionCounter.textContent = `Users Counter: ${users.length}`;
    clearSelectionContainer();
    if (!users || users.length === 0)
    {
        renderEmptyState(selectionContainer, "No Users Found", "col-12 text-center text-light fw-bold");
        return;
    }

    const sortedBy = usersFilters.sort || "createdAt";
    // Date-valued sort fields need .toLocaleDateString().
    const sortedByType = (sortedBy === "createdAt" || sortedBy === "birthday") ? "date" : "text";

    selectionContainer.innerHTML = users.map(user =>
    {
        const secondaryValue = sortedByType === "date" ? user[sortedBy].toLocaleDateString() : user[sortedBy];
        return renderWideCard({
            id: user.id,
            imageUrl: profileImageUrl('UNDEFINED_PROFILE.png'),
            title: user.fullName,
            subtitle: String(secondaryValue ?? ''),
            action: 'select'
        });
    }).join('');
}

function renderContentsSelection()
{
    selectionCounter.textContent = `Contents Counter: ${contents.length}`;
    clearSelectionContainer();
    if (!contents || contents.length === 0)
    {
        renderEmptyState(selectionContainer, "No Contents Found", "col-12 text-center text-light fw-bold");
        return;
    }

    const sortedBy = contentsFilters.sort || "createdAt";
    const dateFields = ["createdAt", "release_date"];
    const sortedByType = dateFields.includes(sortedBy) ? "date" : "text";

    selectionContainer.innerHTML = contents.map(content =>
    {
        const secondaryValue = sortedByType === "date" ? content[sortedBy].toLocaleDateString() : content[sortedBy];
        return renderWideCard({
            id: content.id,
            imageUrl: coverUrl(content.cover_image_name),
            title: content.title,
            subtitle: String(secondaryValue ?? ''),
            action: 'select'
        });
    }).join('');
}

function renderReviewsSelection()
{
    selectionCounter.textContent = `Reviews Counter: ${reviews.length}`;
    clearSelectionContainer();
    if (!reviews || reviews.length === 0)
    {
        renderEmptyState(selectionContainer, "No Reviews Found", "col-12 text-center text-light fw-bold");
        return;
    }

    selectionContainer.innerHTML = reviews.map(review =>
    {
        const secondaryValue = review.comment ? review.comment : "(no comment)";
        return renderWideCard({
            id: review.id,
            imageUrl: '/assets/netflix_logo.png',
            title: `Rating: ${review.rating}/10`,
            subtitle: secondaryValue,
            action: 'select'
        });
    }).join('');
}

//=============== Filter / search handling ===============
async function searchUsersFilters(filters = {})
{
    usersFilters = filters;
    const response = await Backend.searchUsers(token, usersFilters);
    if (!isOk(response, "search users"))
    {
        failInModal(response.message || "Failed to load users");
        return;
    }
    users = response.users;
    mainRenderer();
    closeActiveModal();
}

async function searchContentsFilters(filters = {})
{
    contentsFilters = filters;
    const response = await Backend.getAllContentItems(contentsFilters);
    if (!isOk(response, "load content"))
    {
        failInModal(response.message || "Failed to load content, please try again.");
        return;
    }
    if (!response.content)
    {
        failInModal("Failed to load content, please try again.");
        return;
    }
    contents = response.content;
    mainRenderer();
    closeActiveModal();
}

// Reviews search is a public route (no admin token required), same as content search above.
async function searchReviewsFilters(filters = {})
{
    reviewsFilters = filters;
    const response = await Backend.searchReviews(reviewsFilters);
    if (!isOk(response, "load reviews"))
    {
        failInModal(response.message || "Failed to load reviews, please try again.");
        return;
    }
    if (!response.reviews)
    {
        failInModal("Failed to load reviews, please try again.");
        return;
    }
    reviews = response.reviews;
    mainRenderer();
    closeActiveModal();
}

async function updateUser(user)
{
    const formData = getFormValuesFromModal(getActiveModal());
    const changes = buildChangedFields(formData, user, { dateFields: ['birthday'] });

    if (Object.keys(changes).length === 0)
    {
        infoInModal("No changes to update");
        return;
    }

    const response = await Backend.updateUserById(token, user.id, changes);
    if (!response.success)
    {
        failInModal("Update failed, server error: " + response.message);
        return;
    }
    if (!response.user)
    {
        failInModal("User update failed - invalid response from server.");
        return;
    }

    currentTarget = response.user;
    infoInModal("User updated successfully");
    viewUser();
}

//=============== Content: add / update modal ===============
async function createContent()
{
    const formData = getFormValuesFromModal(getActiveModal());
    const arrayFields = ['categories', 'actors'];
    const contentData = {};

    for (const key in formData)
    {
        if (formData[key] === '') continue;
        // Array fields arrive as a comma-separated string; split back into an array.
        contentData[key] = arrayFields.includes(key)
            ? formData[key].split(',').map(value => value.trim()).filter(value => value !== '')
            : formData[key];
    }

    // Required by the backend schema.
    if (!contentData.title || !contentData.type || !contentData.release_date)
    {
        failInModal("Title, type and release date are required");
        return;
    }

    const response = await Backend.createContent(token, contentData);
    if (!response.success)
    {
        failInModal("Creation failed, server error: " + response.message);
        return;
    }
    if (!response.content)
    {
        failInModal("Content creation failed - invalid response from server.");
        return;
    }

    contents.push(response.content);
    currentTarget = response.content;
    infoInModal("Content created successfully");
    viewContent();
}

// Appends " (Optional)" to labels in create mode where the field can be left blank.
function optionalLabel(isCreateMode, text)
{
    return isCreateMode ? `${text} (Optional)` : text;
}

// contentItem = null -> "Add Content" mode; otherwise "Update Content" mode.
// No Video URL field here (video lives on Episodes); rating/imdb fields are read-only.
function createUpdateContentModal(contentItem = null)
{
    const isCreateMode = !contentItem;
    if (!isCreateMode && !(contentItem instanceof ContentItem))
    {
        showErrorMessage("no content selected");
        return null;
    }

    const { overlay, content } = createModalShell(isCreateMode ? 'Add Content' : 'Update Content');

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fieldsContainer);

    // title/type/release_date required on create; blanks are auto-filled from IMDB.
    fieldsContainer.appendChild(buildEditInputField(contentItem, 'title', "Title", 'text'));
    fieldsContainer.appendChild(buildEditInputField(contentItem, 'description', optionalLabel(isCreateMode, "Description"), 'text'));
    fieldsContainer.appendChild(buildEditInputField(contentItem, 'cover_image_name', optionalLabel(isCreateMode, "Cover Image Name"), 'text'));
    fieldsContainer.appendChild(buildEditSelectField(contentItem, 'type', "Type", ['movie', 'series']));
    fieldsContainer.appendChild(buildEditInputField(contentItem, 'categories', optionalLabel(isCreateMode, "Categories"), 'text'));
    fieldsContainer.appendChild(buildEditInputField(contentItem, 'release_date', "Release Date", 'date'));
    fieldsContainer.appendChild(buildEditInputField(contentItem, 'age_limit', optionalLabel(isCreateMode, "Age Limit"), 'number'));
    fieldsContainer.appendChild(buildEditInputField(contentItem, 'actors', optionalLabel(isCreateMode, "Actors"), 'text'));

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        {
            text: isCreateMode ? 'Create' : 'Update',
            className: 'btn btn-primary btn-lg',
            onClick: () => { isCreateMode ? createContent() : updateContent(contentItem); },
            listenForEnter: true
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function updateContent(content)
{
    const formData = getFormValuesFromModal(getActiveModal());
    const changes = buildChangedFields(formData, content, {
        dateFields: ['release_date'],
        arrayFields: ['categories', 'actors']
    });

    if (Object.keys(changes).length === 0)
    {
        infoInModal("No changes to update");
        return;
    }

    const response = await Backend.updateContent(token, content.id, changes);
    if (!response.success)
    {
        failInModal("Update failed, server error: " + response.message);
        return;
    }
    if (!response.content)
    {
        failInModal("Content update failed - invalid response from server.");
        return;
    }

    currentTarget = response.content;
    infoInModal("Content updated successfully");
    viewContent();
}

//=============== Episode management ===============
// Series: full episode list with add/edit/delete controls. Movie: set/update video control.
async function renderEpisodesSection(content)
{
    const container = document.createElement('div');
    container.className = 'w-100 p-4';

    if (content.type === 'series')
    {
        const response = await Backend.getContentEpisodes(content.id);
        if (!response.success)
        {
            const errorParagraph = document.createElement('p');
            errorParagraph.className = 'text-danger fs-5';
            errorParagraph.textContent = 'Failed to load episodes: ' + response.message;
            container.appendChild(errorParagraph);
            viewContainer.appendChild(container);
            return;
        }

        currentTargetEpisodes = response.seasons ?? [];

        const heading = document.createElement('h2');
        heading.className = 'fw-bold mb-3 text-danger';
        heading.textContent = 'Episodes';
        container.appendChild(heading);

        const addEpisodeButton = document.createElement('button');
        addEpisodeButton.className = 'btn btn-primary btn-lg mb-3';
        addEpisodeButton.textContent = 'Add Episode';
        addEpisodeButton.addEventListener('click', () => openModal(() => createEpisodeModal(content.id)));
        container.appendChild(addEpisodeButton);

        if (currentTargetEpisodes.length === 0)
        {
            const emptyParagraph = document.createElement('p');
            emptyParagraph.className = 'text-light fs-5';
            emptyParagraph.textContent = 'No episodes yet';
            container.appendChild(emptyParagraph);
        }

        currentTargetEpisodes.forEach((seasonEpisodes, seasonIndex) =>
        {
            const seasonNumber = seasonIndex + 1;

            const seasonHeading = document.createElement('h4');
            seasonHeading.className = 'text-warning mt-3';
            seasonHeading.textContent = `Season ${seasonNumber}`;
            container.appendChild(seasonHeading);

            if (seasonEpisodes.length === 0)
            {
                const emptySeasonParagraph = document.createElement('p');
                emptySeasonParagraph.className = 'text-light';
                emptySeasonParagraph.textContent = 'No episodes in this season';
                container.appendChild(emptySeasonParagraph);
                return;
            }

            seasonEpisodes.forEach(episode =>
            {
                const row = document.createElement('div');
                row.className = FIELD_ITEM_CLASSES;

                const labelParagraph = document.createElement('p');
                labelParagraph.className = LABEL_CLASSES;
                labelParagraph.textContent = `E${episode.episodeNumber} - ${episode.title || '(no title)'}`;
                row.appendChild(labelParagraph);

                const buttonRow = document.createElement('div');
                buttonRow.className = 'd-flex';

                const editButton = document.createElement('button');
                editButton.className = 'btn btn-secondary mx-1';
                editButton.textContent = 'Edit';
                editButton.addEventListener('click', () => openModal(() => createEpisodeModal(content.id, episode)));
                buttonRow.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn btn-danger mx-1';
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', () => handleDeleteEpisodeClick(content.id, episode));
                buttonRow.appendChild(deleteButton);

                row.appendChild(buttonRow);
                container.appendChild(row);
            });
        });
    }
    else if (content.type === 'movie')
    {
        currentTargetEpisodes = null;

        const heading = document.createElement('h2');
        heading.className = 'fw-bold mb-3 text-danger';
        heading.textContent = 'Movie Video';
        container.appendChild(heading);

        // No endpoint to read a movie's current video URL; this can only set/replace it.
        const noteParagraph = document.createElement('p');
        noteParagraph.className = 'text-light';
        noteParagraph.textContent = "There's no way to look up this movie's current video URL - enter a new one below to set or replace it.";
        container.appendChild(noteParagraph);

        const inputRow = document.createElement('div');
        inputRow.className = FIELD_ITEM_CLASSES;

        const labelParagraph = document.createElement('p');
        labelParagraph.className = LABEL_CLASSES;
        labelParagraph.textContent = 'Video URL';
        inputRow.appendChild(labelParagraph);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'movie_video_url';
        input.className = INPUT_CLASSES;
        inputRow.appendChild(input);
        container.appendChild(inputRow);

        const setButton = document.createElement('button');
        setButton.className = 'btn btn-primary btn-lg mt-2';
        setButton.textContent = 'Set Movie Video';
        setButton.addEventListener('click', () => withUiLock(setButton, () => handleSetMovieVideoClick(content.id, input)));
        container.appendChild(setButton);
    }

    viewContainer.appendChild(container);
}

async function handleSetMovieVideoClick(contentId, input)
{
    const videoUrl = input.value.trim();
    if (!videoUrl)
    {
        showErrorMessage('Please enter a video URL');
        return;
    }

    const response = await Backend.setMovieVideo(token, contentId, videoUrl);
    if (!response.success)
    {
        showErrorMessage('Failed to set movie video: ' + response.message);
        return;
    }

    showMessage('Movie video set successfully');
    input.value = '';
}

// episode = null -> "Add Episode" mode; otherwise "Update Episode" mode.
// Field ids match Episode's property names so prefill/highlight works; submit handlers
// map them to the API's snake_case body keys.
function createEpisodeModal(contentId, episode = null)
{
    const isCreateMode = !episode;
    const { overlay, content } = createModalShell(isCreateMode ? 'Add Episode' : 'Update Episode');

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fieldsContainer);

    fieldsContainer.appendChild(buildEditInputField(episode, 'seasonNumber', "Season Number", 'number'));
    fieldsContainer.appendChild(buildEditInputField(episode, 'episodeNumber', "Episode Number", 'number'));
    fieldsContainer.appendChild(buildEditInputField(episode, 'title', "Title", 'text'));
    fieldsContainer.appendChild(buildEditInputField(episode, 'videoUrl', "Video URL", 'text'));

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        {
            text: isCreateMode ? 'Create' : 'Update',
            className: 'btn btn-primary btn-lg',
            onClick: () => { isCreateMode ? createEpisode(contentId) : updateEpisode(contentId, episode); },
            listenForEnter: true
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function createEpisode(contentId)
{
    const formData = getFormValuesFromModal(getActiveModal());

    if (formData.seasonNumber === '' || formData.episodeNumber === '')
    {
        failInModal('Season number and episode number are required');
        return;
    }

    const episodeData = {
        season_number: Number(formData.seasonNumber),
        episode_number: Number(formData.episodeNumber)
    };
    if (formData.title !== '') episodeData.title = formData.title;
    if (formData.videoUrl !== '') episodeData.videoUrl = formData.videoUrl;

    const response = await Backend.addEpisode(token, contentId, episodeData);
    if (!response.success)
    {
        failInModal('Failed to add episode: ' + response.message);
        return;
    }

    infoInModal('Episode added successfully');
    await viewContent();
}

async function updateEpisode(contentId, episode)
{
    const formData = getFormValuesFromModal(getActiveModal());
    // Maps camelCase field ids to the snake_case body keys the endpoint expects.
    const keyMap = { seasonNumber: 'season_number', episodeNumber: 'episode_number', title: 'title', videoUrl: 'videoUrl' };
    const changes = {};

    for (const formKey in keyMap)
    {
        if (formData[formKey] === "") continue;

        const originalValue = String(episode[formKey] ?? '');
        if (formData[formKey] !== originalValue)
        {
            const bodyKey = keyMap[formKey];
            changes[bodyKey] = (formKey === 'seasonNumber' || formKey === 'episodeNumber')
                ? Number(formData[formKey])
                : formData[formKey];
        }
    }

    if (Object.keys(changes).length === 0)
    {
        infoInModal('No changes to update');
        return;
    }

    const response = await Backend.updateEpisode(token, contentId, episode.id, changes);
    if (!response.success)
    {
        failInModal('Failed to update episode: ' + response.message);
        return;
    }

    infoInModal('Episode updated successfully');
    await viewContent();
}

function handleDeleteEpisodeClick(contentId, episode)
{
    confirmAndRemove({
        message: `Are you sure you want to delete episode "S${episode.seasonNumber}E${episode.episodeNumber}"?`,
        action: () => Backend.deleteEpisode(token, contentId, episode.id),
        successMessage: 'Episode deleted successfully',
        actionLabel: 'delete episode',
        onSuccess: () => viewContent()
    });
}

//=============== Review: update modal ===============
// Only rating and comment are editable; the ids a review points to are fixed.
function createUpdateReviewModal(reviewItem)
{
    if (!reviewItem || !(reviewItem instanceof Review))
    {
        showErrorMessage("No review selected");
        return null;
    }

    const { overlay, content } = createModalShell('Update Review');

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = FIELDS_CONTAINER_CLASSES;
    content.appendChild(fieldsContainer);

    fieldsContainer.appendChild(buildEditInputField(reviewItem, 'rating', "Rating (1-10)", 'number'));
    fieldsContainer.appendChild(buildEditInputField(reviewItem, 'comment', "Comment", 'text'));

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        { text: 'Update', className: 'btn btn-primary btn-lg', onClick: () => updateReview(reviewItem), listenForEnter: true },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function updateReview(review)
{
    const formData = getFormValuesFromModal(getActiveModal());
    const changes = {};

    // Only send changed fields.
    for (const key in formData)
    {
        if (!(key in review)) continue;
        if (formData[key] === "") continue;

        const originalValue = String(review[key] ?? '');
        if (formData[key] !== originalValue)
        {
            changes[key] = (key === 'rating') ? Number(formData[key]) : formData[key];
        }
    }

    if (Object.keys(changes).length === 0)
    {
        infoInModal("No changes to update");
        return;
    }

    const response = await Backend.adminUpdateReview(token, review.id, changes);
    if (!response.success)
    {
        failInModal("Update failed, server error: " + response.message);
        return;
    }
    if (!response.review)
    {
        failInModal("Review update failed - invalid response from server.");
        return;
    }

    currentTarget = response.review;
    infoInModal("Review updated successfully");
    viewReview();
}

//=============== Filter modals (config-driven) ===============
function createUsersFiltersModal(filters)
{
    return createFiltersModal('Users filters Setup', [
        { groupName: 'Full Name', fields: [
            { id: 'fullname_starts', label: 'Starts with' },
            { id: 'fullname_ends', label: 'Ends with' },
            { id: 'fullname_contains', label: 'Contains' },
        ] },
        { groupName: 'Email', fields: [
            { id: 'email_starts', label: 'Starts with' },
            { id: 'email_ends', label: 'Ends with' },
            { id: 'email_contains', label: 'Contains' },
        ] },
        { groupName: 'Phone', fields: [
            { id: 'phone_starts', label: 'Starts with' },
            { id: 'phone_ends', label: 'Ends with' },
            { id: 'phone_contains', label: 'Contains' },
        ] },
        { groupName: 'Birth Date', fields: [
            { id: 'born_after', label: 'After', type: 'date' },
            { id: 'born_before', label: 'Before', type: 'date' },
        ] },
        { groupName: 'Join Date', fields: [
            { id: 'joined_after', label: 'After', type: 'date' },
            { id: 'joined_before', label: 'Before', type: 'date' },
        ] },
        { groupName: 'Sort', fields: [
            { kind: 'select', id: 'sort', label: 'Sort', options: ['createdAt', 'birthday', 'fullName', 'email'] },
            { kind: 'select', id: 'sortOrder', label: 'Sort Order', options: ['greater_to_smaller', 'smaller_to_greater'] },
        ] },
        { groupName: 'Pagination', fields: [
            { id: 'limit', label: 'Limit', type: 'number' },
            { id: 'skip', label: 'Skip', type: 'number' },
        ] },
    ], searchUsersFilters, filters);
}

function createContentsFiltersModal(filters)
{
    return createFiltersModal('Contents filters Setup', [
        { groupName: 'Title', fields: [
            { id: 'title_starts', label: 'Starts with' },
            { id: 'title_ends', label: 'Ends with' },
            { id: 'title_contains', label: 'Contains' },
        ] },
        { groupName: 'Categories (comma separated)', fields: [
            { id: 'exact_category', label: 'Exact' },
            { id: 'contain_category', label: 'Contains' },
            { id: 'exclude_category', label: 'Exclude' },
        ] },
        { groupName: 'Type', fields: [
            { kind: 'select', id: 'type', label: 'Type', options: ['all', 'series', 'movie'] },
        ] },
        { groupName: 'Release Date', fields: [
            { id: 'released_after', label: 'After', type: 'date' },
            { id: 'released_before', label: 'Before', type: 'date' },
        ] },
        { groupName: 'Age Limit', fields: [
            { id: 'min_age_limit', label: 'Min', type: 'number' },
            { id: 'max_age_limit', label: 'Max', type: 'number' },
        ] },
        { groupName: 'Likes', fields: [
            { id: 'min_likes', label: 'Minimum likes', type: 'number' },
        ] },
        { groupName: 'Rating & Reviews', fields: [
            { id: 'min_average_rating', label: 'Min avg rating', type: 'number' },
            { id: 'max_average_rating', label: 'Max avg rating', type: 'number' },
            { id: 'min_review_count', label: 'Min review count', type: 'number' },
            { id: 'max_review_count', label: 'Max review count', type: 'number' },
        ] },
        { groupName: 'Sort', fields: [
            { kind: 'select', id: 'sort', label: 'Sort', options: ['createdAt', 'likes', 'title', 'age_limit', 'release_date', 'average_rating', 'review_count'] },
            { kind: 'select', id: 'sortOrder', label: 'Sort Order', options: ['greater_to_smaller', 'smaller_to_greater'] },
        ] },
        { groupName: 'Pagination', fields: [
            { id: 'limit', label: 'Limit', type: 'number' },
            { id: 'skip', label: 'Skip', type: 'number' },
        ] },
    ], searchContentsFilters, filters);
}

function createReviewsFiltersModal(filters)
{
    return createFiltersModal('Reviews filters Setup', [
        { groupName: 'IDs', fields: [
            { id: 'content_id', label: 'Content ID' },
            { id: 'episode_id', label: 'Episode ID' },
            { id: 'profile_id', label: 'Profile ID' },
            { id: 'user_id', label: 'User ID' },
        ] },
        { groupName: 'Rating', fields: [
            { id: 'rating', label: 'Exact', type: 'number' },
            { id: 'min_rating', label: 'Min', type: 'number' },
            { id: 'max_rating', label: 'Max', type: 'number' },
        ] },
        { groupName: 'Comment', fields: [
            { id: 'comment_starts', label: 'Starts with' },
            { id: 'comment_ends', label: 'Ends with' },
            { id: 'comment_contains', label: 'Contains' },
        ] },
        { groupName: 'Sort', fields: [
            { kind: 'select', id: 'sort', label: 'Sort', options: ['rating'] },
            { kind: 'select', id: 'sortOrder', label: 'Sort Order', options: ['greater_to_smaller', 'smaller_to_greater'] },
        ] },
        { groupName: 'Pagination', fields: [
            { id: 'limit', label: 'Limit', type: 'number' },
            { id: 'skip', label: 'Skip', type: 'number' },
        ] },
    ], searchReviewsFilters, filters);
}

//=============== Permission modal ===============
function createSetPermissionModal(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        showErrorMessage("No user selected");
        return null;
    }

    const { overlay, content } = createModalShell(`Set Permission - ${user.fullName}`);

    const select = document.createElement('select');
    select.id = 'permission_level';
    select.className = 'form-select w-75 mx-auto my-4';

    // Sorted numerically so the dropdown lists USER, ADMIN, SUPER_ADMIN in order.
    Object.keys(permissionLookup)
        .sort((a, b) => Number(a) - Number(b))
        .forEach(levelKey =>
        {
            const optionElement = document.createElement('option');
            optionElement.value = levelKey;
            optionElement.textContent = permissionLookup[levelKey];
            select.appendChild(optionElement);
        });

    select.value = String(user.permission_level);
    content.appendChild(select);

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        {
            text: 'Save',
            className: 'btn btn-primary btn-lg',
            listenForEnter: true,
            onClick: async () =>
            {
                const newLevel = Number(select.value);
                if (newLevel === user.permission_level)
                {
                    infoInModal("No changes to update");
                    return;
                }

                const response = await Backend.setUserPermissionLevel(token, user.id, newLevel);
                if (!response.success)
                {
                    failInModal("Permission update failed, server error: " + response.message);
                    return;
                }

                // Endpoint doesn't return the updated user, so update locally.
                user.permission_level = newLevel;
                currentTarget = user;
                infoInModal("Permission level updated successfully");
                viewUser();
            }
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

//=============== Ban modal ===============
// Prompts the admin for the ban duration in hours.
function createBanUserModal(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        showErrorMessage("No user selected");
        return null;
    }

    const { overlay, content } = createModalShell(`Ban User - ${user.fullName}`);

    const labelParagraph = document.createElement('p');
    labelParagraph.className = LABEL_CLASSES;
    labelParagraph.textContent = "Ban duration (hours):";
    content.appendChild(labelParagraph);

    const hoursInput = document.createElement('input');
    hoursInput.type = 'number';
    hoursInput.id = 'ban_hours';
    hoursInput.min = '1';
    hoursInput.value = '24'; // default "standard" ban
    hoursInput.className = 'form-control w-50 mx-auto mb-4';
    content.appendChild(hoursInput);

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        {
            text: 'Ban',
            className: 'btn btn-danger btn-lg',
            listenForEnter: true,
            onClick: async () =>
            {
                const hours = Number(hoursInput.value);
                if (!hours || hours <= 0)
                {
                    showErrorMessage("Please enter a valid number of hours");
                    return;
                }
                await confirmBanUser(user, hours);
            }
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

//=============== Statistics modals ===============
// One "Statistics" button per mode; each renders its endpoint's numbers as D3 bar charts.

// Rounds to 2 decimals for clean average-rating chart labels.
function roundToTwoDecimalPlaces(rawNumber)
{
    return Math.round((rawNumber + Number.EPSILON) * 100) / 100;
}

/**
 * Draws one D3.js bar chart into `chartContainer`. Reused for every chart: each statistic is
 * an array of objects with one category field (X axis) and one number field (bar height).
 *
 * @param {HTMLElement} chartContainer - empty <div> the chart will be built inside
 * @param {Array<Object>} dataPoints - e.g. [{ Month: "2026-01", NewUsers: 12 }, ...]
 * @param {string} categoryField - name of the field to use as the X axis label, e.g. "Month"
 * @param {string} valueField - name of the field to use as the bar height, e.g. "NewUsers"
 * @param {string} chartTitle - text shown above the chart
 */
function drawBarChartWithD3(chartContainer, dataPoints, categoryField, valueField, chartTitle)
{
    chartContainer.innerHTML = '';

    const chartTitleElement = document.createElement('h4');
    chartTitleElement.className = 'text-warning text-center mt-4';
    chartTitleElement.textContent = chartTitle;
    chartContainer.appendChild(chartTitleElement);

    if (!dataPoints || dataPoints.length === 0)
    {
        const noDataMessage = document.createElement('p');
        noDataMessage.className = 'text-light text-center';
        noDataMessage.textContent = 'No data available.';
        chartContainer.appendChild(noDataMessage);
        return;
    }

    const svgWidth = 520;
    const svgHeight = 320;
    const chartMargin = { top: 20, right: 20, bottom: 80, left: 50 };
    const drawingWidth = svgWidth - chartMargin.left - chartMargin.right;
    const drawingHeight = svgHeight - chartMargin.top - chartMargin.bottom;

    const svgElement = d3.select(chartContainer)
        .append('svg')
        .attr('width', svgWidth)
        .attr('height', svgHeight)
        .attr('class', 'd-block mx-auto');

    // Inner group shifted by the margins so drawing never overlaps the axis labels.
    const drawingGroup = svgElement.append('g')
        .attr('transform', `translate(${chartMargin.left}, ${chartMargin.top})`);

    const xScale = d3.scaleBand()
        .domain(dataPoints.map(dataPoint => String(dataPoint[categoryField])))
        .range([0, drawingWidth])
        .padding(0.25);

    const largestValue = d3.max(dataPoints, dataPoint => dataPoint[valueField]) || 1;
    const yScale = d3.scaleLinear()
        .domain([0, largestValue])
        .range([drawingHeight, 0]); // SVG's Y axis grows downward, so this flips it

    drawingGroup.append('g')
        .attr('transform', `translate(0, ${drawingHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('fill', 'white')
        .attr('transform', 'rotate(-30)') // angled so longer labels don't overlap
        .style('text-anchor', 'end');

    drawingGroup.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll('text')
        .attr('fill', 'white');

    // Axis lines default to black (invisible on the dark background); force white.
    drawingGroup.selectAll('.domain, .tick line').attr('stroke', 'white');

    drawingGroup.selectAll('.statistics-bar')
        .data(dataPoints)
        .enter()
        .append('rect')
        .attr('class', 'statistics-bar')
        .attr('x', dataPoint => xScale(String(dataPoint[categoryField])))
        .attr('y', dataPoint => yScale(dataPoint[valueField]))
        .attr('width', xScale.bandwidth())
        .attr('height', dataPoint => drawingHeight - yScale(dataPoint[valueField]))
        .attr('fill', '#0d6efd');

    // Numeric value printed above each bar.
    drawingGroup.selectAll('.statistics-bar-label')
        .data(dataPoints)
        .enter()
        .append('text')
        .attr('class', 'statistics-bar-label')
        .attr('x', dataPoint => xScale(String(dataPoint[categoryField])) + xScale.bandwidth() / 2)
        .attr('y', dataPoint => yScale(dataPoint[valueField]) - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .text(dataPoint => dataPoint[valueField]);
}

/**
 * Shared shell for all 3 statistics modals: opens the modal, shows a loading message, calls
 * `fetchStatistics()`, and once it resolves either shows an error or hands the returned
 * `statistics` object to `renderCharts` to draw into the charts container.
 *
 * @param {string} modalTitle
 * @param {() => Promise<Object>} fetchStatistics - e.g. () => Backend.getUsersStatistics(token)
 * @param {(chartsContainer: HTMLElement, statistics: Object) => void} renderCharts
 */
function createStatisticsModal(modalTitle, fetchStatistics, renderCharts)
{
    const { overlay, content } = createModalShell(modalTitle, { widthClass: 'col-11 col-lg-8' });

    const loadingMessage = document.createElement('p');
    loadingMessage.className = 'text-light fs-5';
    loadingMessage.textContent = 'Loading statistics...';
    content.appendChild(loadingMessage);

    // All the charts get appended into this single container once the data arrives.
    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'w-100';
    content.appendChild(chartsContainer);

    content.appendChild(createButtonRow([
        { text: 'Close', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
    ]));

    document.body.appendChild(overlay);

    // Fills the already-visible modal (or shows an error) once the request returns.
    (async () =>
    {
        const response = await fetchStatistics();
        loadingMessage.remove();

        if (!response.success || !response.statistics)
        {
            const errorMessage = document.createElement('p');
            errorMessage.className = 'text-danger fs-5';
            errorMessage.textContent = 'Failed to load statistics: ' + (response.message || 'unknown error');
            chartsContainer.appendChild(errorMessage);
            return;
        }

        renderCharts(chartsContainer, response.statistics);
    })();

    return overlay;
}

// Users mode: 3 charts matching Backend.getUsersStatistics().
function renderUsersStatisticsCharts(chartsContainer, statistics)
{
    const profileDistributionChart = document.createElement('div');
    chartsContainer.appendChild(profileDistributionChart);
    drawBarChartWithD3(profileDistributionChart, statistics.profileDistribution, 'NumberOfProfiles', 'UsersCount', 'Profiles per User');

    const userGrowthChart = document.createElement('div');
    chartsContainer.appendChild(userGrowthChart);
    drawBarChartWithD3(userGrowthChart, statistics.userGrowth, 'Month', 'NewUsers', 'New Users per Month');

    const ageDistributionChart = document.createElement('div');
    chartsContainer.appendChild(ageDistributionChart);
    drawBarChartWithD3(ageDistributionChart, statistics.ageDistribution, 'AgeRange', 'UsersCount', 'Users by Age Range');
}

function createUsersStatisticsModal()
{
    return createStatisticsModal(
        'Users Statistics',
        () => Backend.getUsersStatistics(token),
        renderUsersStatisticsCharts
    );
}

// Contents mode: 5 charts + one plain-text average, matching Backend.getContentStatistics().
function renderContentStatisticsCharts(chartsContainer, statistics)
{
    const viewsByCategoryChart = document.createElement('div');
    chartsContainer.appendChild(viewsByCategoryChart);
    drawBarChartWithD3(viewsByCategoryChart, statistics.viewsByCategory, 'Category', 'ViewsCount', 'Views by Category');

    const mostViewedContentChart = document.createElement('div');
    chartsContainer.appendChild(mostViewedContentChart);
    drawBarChartWithD3(mostViewedContentChart, statistics.mostViewedContent, 'Title', 'ViewsCount', 'Most Viewed Content (Top 5)');

    const categoryDistributionChart = document.createElement('div');
    chartsContainer.appendChild(categoryDistributionChart);
    drawBarChartWithD3(categoryDistributionChart, statistics.categoryDistribution, 'Category', 'TitlesCount', 'Titles per Category');

    // averageEpisodesPerSeries is a single number, shown as plain text.
    const averageEpisodesMessage = document.createElement('p');
    averageEpisodesMessage.className = 'text-light fs-5 text-center mt-4';
    averageEpisodesMessage.textContent =
        `Average Episodes per Series: ${roundToTwoDecimalPlaces(statistics.episodesPerSeriesStats.averageEpisodesPerSeries)}`;
    chartsContainer.appendChild(averageEpisodesMessage);

    const episodesDistributionChart = document.createElement('div');
    chartsContainer.appendChild(episodesDistributionChart);
    drawBarChartWithD3(
        episodesDistributionChart,
        statistics.episodesPerSeriesStats.episodesDistribution,
        'EpisodesRange', 'SeriesCount', 'Series by Episode Count'
    );

    const ageDistributionChart = document.createElement('div');
    chartsContainer.appendChild(ageDistributionChart);
    drawBarChartWithD3(ageDistributionChart, statistics.ageDistribution, 'AgeRange', 'TitlesCount', 'Titles by Age Rating');
}

function createContentStatisticsModal()
{
    return createStatisticsModal(
        'Content Statistics',
        () => Backend.getContentStatistics(token),
        renderContentStatisticsCharts
    );
}

// Reviews mode: 3 charts matching Backend.getReviewsStatistics().
function renderReviewsStatisticsCharts(chartsContainer, statistics)
{
    const ratingDistributionChart = document.createElement('div');
    chartsContainer.appendChild(ratingDistributionChart);
    drawBarChartWithD3(ratingDistributionChart, statistics.ratingDistribution, 'Rating', 'ReviewsCount', 'Reviews by Rating (1-10)');

    // Round decimal averages for clean bar labels.
    const roundedCategoryAverageRatings = statistics.categoryAverageRating.map(entry => ({
        Category: entry.Category,
        AverageRating: roundToTwoDecimalPlaces(entry.AverageRating)
    }));
    const categoryAverageRatingChart = document.createElement('div');
    chartsContainer.appendChild(categoryAverageRatingChart);
    drawBarChartWithD3(categoryAverageRatingChart, roundedCategoryAverageRatings, 'Category', 'AverageRating', 'Average Rating per Category');

    const monthlyReviewCountChart = document.createElement('div');
    chartsContainer.appendChild(monthlyReviewCountChart);
    drawBarChartWithD3(monthlyReviewCountChart, statistics.monthlyAverageRating, 'Month', 'ReviewsCount', 'Reviews Count per Month');
}

function createReviewsStatisticsModal()
{
    return createStatisticsModal(
        'Reviews Statistics',
        () => Backend.getReviewsStatistics(token),
        renderReviewsStatisticsCharts
    );
}

// Separated from createBanUserModal() to keep the API call out of the onClick handler.
async function confirmBanUser(user, hoursToBan)
{
    const response = await Backend.banUser(token, user.id, hoursToBan);
    if (!response.success)
    {
        failInModal("Ban failed, server error: " + response.message);
        return;
    }

    // Drop the banned user from the visible list.
    users = users.filter(existingUser => existingUser.id !== user.id);
    if (currentTarget === user) currentTarget = null;
    if (user.id === activeUser.id)
    {
        closeActiveModal();
        redirectToIndex();
        return;
    }
    infoInModal(`User banned successfully for ${hoursToBan} hours`);
    mainRenderer();
}

//=============== Select-by-id modal ===============
// Generic "jump to this ID" modal for all modes. Users/Content fetch from the server;
// Reviews has no get-by-id endpoint, so it only matches the currently loaded results.
function createSelectByIdModal(entityLabel, onSelect)
{
    const { overlay, content } = createModalShell(`Select ${entityLabel} by ID`);

    const labelParagraph = document.createElement('p');
    labelParagraph.className = LABEL_CLASSES;
    labelParagraph.textContent = `${entityLabel} ID:`;
    content.appendChild(labelParagraph);

    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.id = 'select_by_id_input';
    idInput.className = 'form-control w-75 mx-auto mb-4';
    content.appendChild(idInput);

    content.appendChild(createButtonRow([
        { text: 'Cancel', className: 'btn btn-secondary btn-lg', onClick: () => closeActiveModal() },
        {
            text: 'Select',
            className: 'btn btn-primary btn-lg',
            listenForEnter: true,
            onClick: async () =>
            {
                const id = idInput.value.trim();
                if (!id)
                {
                    showErrorMessage('Please enter an ID');
                    return;
                }
                await onSelect(id);
            }
        },
    ]));

    document.body.appendChild(overlay);
    return overlay;
}

async function selectUserById(id)
{
    const response = await Backend.fetchUserById(token, id);
    if (!response.success || !response.user)
    {
        failInModal("User not found: " + (response.message || 'unknown error'));
        return;
    }
    currentTarget = response.user;
    closeActiveModal();
    await viewUser();
}

async function selectContentById(id)
{
    const response = await Backend.getContentByID(id);
    if (!response.success || !response.content)
    {
        failInModal("Content not found: " + (response.message || 'unknown error'));
        return;
    }
    currentTarget = response.content;
    closeActiveModal();
    await viewContent();
}

// Reviews have no get-by-id endpoint; match only against the loaded results.
async function selectReviewById(id)
{
    const found = reviews.find(review => review.id === id);
    if (!found)
    {
        failInModal("Review not found in the currently loaded list - try adjusting the review search filters first.");
        return;
    }
    currentTarget = found;
    closeActiveModal();
    viewReview();
}

// NOTE: relies on Backend.findUserByProfileId() -> GET /admin/profiles/:profileId/owner,
// which is not yet implemented server-side.
async function selectUserByProfileId(profileId)
{
    const response = await Backend.findUserByProfileId(token, profileId);
    if (!response.success || !response.user)
    {
        failInModal("User not found for that profile ID: " + (response.message || 'unknown error'));
        return;
    }
    currentTarget = response.user;
    closeActiveModal();
    await viewUser();
}

//=============== Confirmation / delete ===============

function handleDeleteContentClick(content)
{
    if (!content || !(content instanceof ContentItem))
    {
        showErrorMessage("No content selected");
        return;
    }

    confirmAndRemove({
        message: `Are you sure you want to delete "${content.title}"?`,
        action: () => Backend.deleteContent(token, content.id),
        successMessage: "Content deleted successfully",
        actionLabel: "delete content",
        onSuccess: () =>
        {
            contents = contents.filter(existingContent => existingContent.id !== content.id);
            if (currentTarget === content) currentTarget = null;
            mainRenderer();
        }
    });
}

function handleDeleteUserClick(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        showErrorMessage("No user selected");
        return;
    }

    confirmAndRemove({
        message: `Are you sure you want to delete "${user.fullName}"?`,
        action: () => Backend.deleteUser(token, user.id),
        successMessage: "User deleted successfully",
        actionLabel: "delete user",
        onSuccess: () =>
        {
            users = users.filter(existingUser => existingUser.id !== user.id);
            if (currentTarget === user) currentTarget = null;
            mainRenderer();
        }
    });
}

function handleDeleteReviewClick(review)
{
    if (!review || !(review instanceof Review))
    {
        showErrorMessage("No review selected");
        return;
    }

    confirmAndRemove({
        message: `Are you sure you want to delete this review (Rating: ${review.rating}/10)?`,
        action: () => Backend.adminDeleteReview(token, review.id),
        successMessage: "Review deleted successfully",
        actionLabel: "delete review",
        onSuccess: () =>
        {
            reviews = reviews.filter(existingReview => existingReview.id !== review.id);
            if (currentTarget === review) currentTarget = null;
            mainRenderer();
        }
    });
}

function handleKickUserClick(user)
{
    if (!user || !(user instanceof UserInfo))
    {
        showErrorMessage("No user selected");
        return;
    }

    confirmAndRemove({
        message: `Are you sure you want to kick "${user.fullName}"?`,
        confirmText: 'Kick',
        action: () => Backend.kickUser(token, user.id),
        actionLabel: "kick user",
        onSuccess: () =>
        {
            users = users.filter(existingUser => existingUser.id !== user.id);
            if (user.id === activeUser.id)
            {
                redirectToIndex();
                return;
            }
            showMessage("User kicked successfully");
            mainRenderer();
        }
    });
}

//=============== Main renderer ===============
// Per mode: run the show/hide animation, wire action buttons, render the list + detail.
function revealContainers()
{
    selectionContainer.style.display = "block";
    viewContainer.style.display = "block";
    controlContainer.style.display = "block";
    selectionCounter.style.display = "block";

    // rAF lets the display:block paint before the transition, so the animation plays.
    requestAnimationFrame(() =>
    {
        selectionContainer.style.transform = "scale(1, 1)";
        viewContainer.style.transform = "scale(1, 1)";
        controlContainer.style.opacity = "1";
        selectionCounter.style.opacity = "1";
    });
}

function mainRenderer()
{
    switch (currentMode)
    {
        case mode.users:
        {
            revealContainers();
            renderControlContainer([
                { name: "Kick", primary: true, function: () => handleKickUserClick(currentTarget) },
                { name: "Search", function: () => openModal(() => createUsersFiltersModal(usersFilters)) },
                { name: "Select by ID", function: () => openModal(() => createSelectByIdModal('User', selectUserById)) },
                { name: "Select by Profile ID", function: () => openModal(() => createSelectByIdModal('Profile', selectUserByProfileId)) },
                { name: "Update", function: () => openModal(() => createUpdateUserModal(currentTarget, updateUser)) },
                { name: "Delete", function: () => handleDeleteUserClick(currentTarget) },
                { name: "My User", function: () => { currentTarget = activeUser; viewUser(); } },
                { name: "Set Permission", function: () => openModal(() => createSetPermissionModal(currentTarget)) },
                { name: "Ban", primary: true, function: () => openModal(() => createBanUserModal(currentTarget)) },
                { name: "Statistics", function: () => openModal(() => createUsersStatisticsModal()) },
            ]);
            renderUsersSelection();
            viewUser();
            break;
        }
        case mode.contents:
        {
            revealContainers();
            renderControlContainer([
                { name: "Add", primary: true, function: () => openModal(() => createUpdateContentModal()) },
                { name: "Search", function: () => openModal(() => createContentsFiltersModal(contentsFilters)) },
                { name: "Select by ID", function: () => openModal(() => createSelectByIdModal('Content', selectContentById)) },
                { name: "Update", primary: true, function: () => openModal(() => createUpdateContentModal(currentTarget)) },
                { name: "Delete", function: () => handleDeleteContentClick(currentTarget) },
                { name: "Statistics", function: () => openModal(() => createContentStatisticsModal()) },
            ]);
            renderContentsSelection();
            viewContent();
            break;
        }
        case mode.reviews:
        {
            revealContainers();
            renderControlContainer([
                { name: "Search", function: () => openModal(() => createReviewsFiltersModal(reviewsFilters)) },
                { name: "Select by ID", function: () => openModal(() => createSelectByIdModal('Review', selectReviewById)) },
                { name: "Update", primary: true, function: () => openModal(() => createUpdateReviewModal(currentTarget)) },
                { name: "Delete", function: () => handleDeleteReviewClick(currentTarget) },
                { name: "Statistics", function: () => openModal(() => createReviewsStatisticsModal()) },
            ]);
            renderReviewsSelection();
            viewReview();
            break;
        }
    }
    renderModeSelector();
}

//=============== Error handling / bootstrap ===============

if (!modeSelectorContainer) throw new Error("mode_selector_container not found");
if (!selectionCounter) throw new Error("selection_counter not found");
if (!controlContainer) throw new Error("controll_container not found");
if (!selectionContainer) throw new Error("selection_container not found");
if (!viewContainer) throw new Error("view_container not found");
if (!msgBox) throw new Error("msg_box not found");

selectionContainer.addEventListener('click', handleSelectionClick);

searchContentsFilters();
searchUsersFilters();
searchReviewsFilters();
clearMessage();

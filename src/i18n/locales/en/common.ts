export const common = {
    actions: {
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        confirm: "Confirm",
        ok: "OK",
        close: "Close",
        back: "Back",
        next: "Next",
        edit: "Edit",
        add: "Add",
        remove: "Remove",
        create: "Create",
        submit: "Submit",
        send: "Send",
        retry: "Retry",
        copy: "Copy",
        download: "Download",
        upload: "Upload",
        reset: "Reset",
        apply: "Apply",
        done: "Done",
        loading: "Loading...",
        search: "Search",
        filter: "Filter",
        clear: "Clear",
        signOut: "Sign out",
        leave: "Leave",
    },
    confirm: {
        deleteTitle: "Are you sure?",
        deleteBody: "This action cannot be undone.",
        unsavedTitle: "Discard unsaved changes?",
        unsavedBody: "Your changes will be lost.",
    },
    leaveConfirm: {
        leave: "Leave",
        cancel: "Cancel",
        genericError: "Couldn't leave. Please try again.",
        teamTitle: "Leave team?",
        teamDescription:
            "You'll lose access to this team's chats and projects. You can re-join later.",
        projectTitle: "Leave project?",
        projectDescription:
            "You'll no longer see this project's messages. You can re-join later if it's public.",
        gmTitle: "Leave group?",
        gmDescription:
            "You'll no longer see this group's messages. You can re-join later if it's public.",
    },
    addMembers: {
        openButton: "Add members",
        headingProject: "Add members to {projectName}",
        headingGM: "Add members to {gmName}",
    },
    // Permission roles shared by Team / Project / GM. Distinct from
    // `admin.role.*`, which labels the user's job title.
    memberRoles: {
        owner: "Owner",
        editor: "Editor",
        viewer: "Viewer",
        sectionLabel: "Role",
        changeFailed: "Couldn't change that member's role.",
    },
    profileEdit: {
        rename: "Rename",
        save: "Save",
        cancel: "Cancel",
        nameEmpty: "Name cannot be empty.",
        renameError: "Couldn't rename. Please try again.",
        transferOwner: "Transfer ownership",
        transferTitle: "Transfer ownership?",
        transferTeamDescription:
            "You'll become a regular member. Only owners can rename or transfer ownership again.",
        transferProjectDescription: "You'll become a regular member of this project.",
        transferGMDescription: "You'll become a regular member of this group.",
        transferPickMember: "Pick a member to receive ownership",
        transferConfirm: "Transfer",
        transferError: "Couldn't transfer ownership. Please try again.",
        noOtherMembers: "No other members to transfer ownership to.",
        // Break-glass recovery for a team whose owner is absent. Only an
        // editor sees these, and only the wording of `claimDescription`
        // sets the expectation that this is slow and visible on purpose
        // — it is not an "escalate to admin" button.
        claimTitle: "Owner unreachable?",
        claimDescription:
            "You can ask the owner to hand over the team. If they don't respond, you'll be able to take ownership after the deadline. They're notified either way.",
        claimRequest: "Request ownership",
        claimPendingTitle: "Ownership request pending",
        claimWaiting:
            "Waiting for the owner. You can take ownership on {date} if they don't reply.",
        claimReady: "The owner didn't reply. You can now take ownership of this team.",
        claimFinalize: "Take ownership",
        claimOtherPending:
            "Another editor has requested ownership of this team. The owner has until {date} to respond.",
        claimCooldown: "The owner declined your request. You can ask again after {date}.",
    },
    empty: {
        noResults: "No results",
        noItems: "Nothing here yet",
    },
    errors: {
        generic: "Something went wrong. Please try again.",
        network: "Network error. Check your connection and try again.",
        unauthorized: "You're not signed in.",
        forbidden: "You don't have permission to do that.",
        notFound: "Not found.",
    },
    validation: {
        required: "This field is required",
        tooShort: "Too short",
        tooLong: "Too long",
        invalid: "Invalid value",
    },
    ui: {
        moreMenu: {
            ariaLabel: "More options",
        },
        colorScheme: {
            switchTheme: "Switch Theme",
        },
        fileUpload: {
            uploadingDefault: "Uploading…",
            pending: "Pending",
            uploading: "Uploading",
            uploadingDroppedFiles: "Uploading dropped files…",
            uploadingFilesOne: "Uploading {count} file…",
            uploadingFilesOther: "Uploading {count} files…",
        },
        fileSize: {
            limitExceededTitle: "File size limit ({label}) exceeded",
            overflowMore: "+ {count} more",
        },
        emoji: {
            reaction: "Emoji Reaction",
            singleReacted: "{names} reacted",
            multipleReacted: "{names} and more reacted",
            moreLabel: "+{count} more",
        },
        // Click-to-copy chips / inline labels (e.g. CopyableTaskId).
        // `copied` swaps in for `clickToCopy` for the brief feedback
        // window after a successful clipboard write.
        copy: {
            clickToCopy: "Click to copy",
            copied: "Copied!",
        },
    },
    initialLoad: {
        loading: "Loading",
        preparingWorkspace: "Preparing your workspace",
        takingLonger: "Taking longer than expected?",
        sessionExpired: "Your session may have expired",
        signInAgain: "Sign In Again",
        // Shown instead of the two lines above when the device is
        // offline — blaming the session there is wrong, and sign-in
        // can't submit without a network anyway.
        offlineTitle: "You're offline",
        offlineBody:
            "Genos can't reach the server right now. It will pick up on its own as soon as your connection returns.",
    },
    modalView: {
        chatUnavailable: "This chat isn't available.",
        noMessagesYet: "No messages to display yet.",
        threadEmpty: "This thread is empty or unavailable.",
        chatLoadFailed: "Failed to load this chat.",
        loadingChat: "Loading…",
        loadingThread: "Loading thread…",
        taskUnavailable: "This task isn't available.",
        taskLoadFailed: "Failed to load this task.",
        loadingTask: "Loading…",
        noteUnavailable: "This note isn't available.",
        noteLoadFailed: "Failed to load this note.",
        loadingNote: "Loading…",
        milestoneUnavailable: "This milestone isn't available.",
        milestoneLoadFailed: "Failed to load this milestone.",
        loadingMilestone: "Loading…",
        todoUnavailable:
            "This todo couldn't be found — it may have been deleted or belong to another user.",
        loadingTodos: "Loading…",
    },
    sessionSuperseded: {
        title: "Switched to another team",
        // `{team}` is the team now signed in via another browser tab.
        body: "You signed in to {team} in another tab. Only one team can be active per browser, so this tab is out of date. Reload to continue.",
        reload: "Reload",
        fallbackTeam: "another team",
    },
    editor: {
        send: "Send",
        sendAriaLabel: "Send message",
        removeBlock: "Remove block",
        resetType: "Reset Type",
        emoji: "Emoji",
        gif: "GIF",
        emojiTypingHint: ":+typing",
        emojiGroup: "Emoji",
        loadingComments: "Loading comments...",
        couldNotLoadComments: "Could not load comments.",
        imageAttachment: "Image attachment",
        attachmentUploadFailed: "Attachment Upload Failed",
        taskBodyAttachmentUploadFailed: "Task BodyAttachment Upload Failed",
        fileSizeExceeded: 'File "{name}" exceeds the {label} limit',
        alertType: "Alert Type",
        alertWarning: "Warning",
        alertError: "Error",
        alertInfo: "Info",
        alertSuccess: "Success",
        delete: "Delete",
        colors: "Colors",
        download: "Download",
        imagePreviewAlt: "preview",
    },
} as const;

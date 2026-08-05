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
    // Cross-team sharing, shared by chats, projects and note folders. Kept
    // object-neutral ("has access", not "in this chat") because one panel
    // renders all three; a shared string that names one surface is how the
    // copy starts lying on the others.
    externalShares: {
        title: "Teams with access",
        explainer:
            "Each team manages its own participants. You can remove someone from another team, but only their owner or editor can add them.",
        participantCount: "{count, plural, one {# participant} other {# participants}}",
        awaitingTheirApproval: "Waiting for this team to accept",
        ceilingViewer: "Up to viewer",
        ceilingEditor: "Up to editor",
        // Both teams, named, owner first. The row used to say "You shared
        // this" or "They shared this with you" — a claim about the READER,
        // which is wrong for anyone who belongs to both teams and useless
        // to anyone comparing two rows. Two names cannot be wrong.
        sharedFromTo: "{owner} shared this with {guest}",
        sharedDirectionHint: "The team on the left owns it. The team on the right was let in.",
        changeCeiling: "Click to switch what {team} may do here.",
        addFromYourTeam: "Add someone from your team",
        removeParticipant: "Remove {name}",
        everyoneAlreadyIn: "Everyone on your team already has access.",
        endShare: "Stop sharing with this team",
        offerPrompt: "Share with a connected team",
        // What the other team gets. Editing by default: a share exists so
        // two teams can work on the same thing, and read-only-by-default
        // meant every project ever shared arrived as something the guest
        // team could look at and not touch.
        offerCeilingLabel: "They can",
        offerCeilingEditor: "Edit",
        offerCeilingViewer: "View only",
        actionFailed: "That didn't work. Please try again.",
    },
    // The "add a person" autocomplete, wherever people are added.
    personPicker: {
        youSuffix: "(You)",
        noMatches: "No matches",
    },
    // Permission roles shared by Team / Project / GM. Distinct from
    // `admin.role.*`, which labels the user's job title.
    memberRoles: {
        owner: "Owner",
        editor: "Editor",
        viewer: "Viewer",
        guest: "Guest",
        sectionLabel: "Role",
        changeFailed: "Couldn't change that member's role.",
        // `MemberRoleControl` indexes this map by the role string, so a
        // missing key renders `undefined` rather than failing to compile.
        guestHint: "Outside collaborator — sees only this project.",
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
        // editor sees these. The button is one word with no context, so
        // `claimConfirmWindow` in the confirm modal carries the whole
        // expectation — that this is slow, and that the owner is told.
        // Without it "Request ownership" reads as escalate-now.
        claimConfirmTitle: "Request ownership of this team?",
        claimDescription:
            "Use this when the owner has left or stopped responding. They're notified straight away and can approve or decline.",
        claimConfirmWindow:
            "If they do neither within {days} days, you'll be able to take ownership yourself. Everyone in the team is told when that happens.",
        claimConfirmSend: "Send request",
        claimError: "Couldn't send the request. Please try again.",
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
        // Chrome button beside the preview's ✕: leave the quick-look and
        // open the entity's own page. Only shown when the surface that
        // opened the preview supplied a navigation action.
        openFullPage: "Move to page",
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
    // Shown after an @mention of someone who can't reach the surface.
    nonMemberMention: {
        body: "{names} can't see this — they're not in {scope}.",
        add: "Add them",
        share: "Share it",
        bodyShare: "{names} can't see this — {scope} isn't shared with them.",
        dismiss: "Dismiss",
    },
} as const;

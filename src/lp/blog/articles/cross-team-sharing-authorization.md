<!-- Generated from genos-docs/marketing/HN_CROSS_TEAM_AUTHORIZATION.md. Run npm run blog:sync; do not edit this copy directly. -->


The feature sounds like a join table: let team B into one object owned by team A.

The constraints make it less simple:

- a connection between teams must grant no data access;
- a share must cover one private chat, project, or note folder, not a tenant;
- team B must manage its own participants without asking team A per person;
- revocation must remove access even if nobody rechecks the share at read time;
- the object must appear inside B's normal workspace without pretending B owns it;
- names, cached tasks, inbox requests, and presence must cross the boundary too.

This is the design used in Genos. It is application-level authorization, not a
formal capability system, and the presence transport has a coarse boundary
described below.

## The agreement is not the permission

Two new records describe intent:

```text
TeamConnection(team_lo, team_hi, status)
ExternalGrant(guest_team, object_type, object_id, role_ceiling, status)
```

The team pair is normalized, so A→B and B→A cannot become separate relationships.
A connection says the teams agreed to work together. It grants nothing.

An external grant says that B may participate in one object owned by A. It also
grants nothing directly.

On acceptance, the service writes the ACL row the object already understands:

```text
chat         → ChannelMember
project      → ProjectMembers(role="guest")
note folder  → NoteFolderPermission
```

Existing task, attachment, note, search, and collaborative-editing checks continue
to authorize against those rows. The grant is control-plane state; the
participation row is data-plane authority.

That choice avoids a second authorization language. It also creates a strict
revocation rule: changing `ExternalGrant.status` is insufficient. Reads do not
consult it. Revocation has to delete every participation row the grant produced.
Removing somebody from the guest team does the same cleanup, or an ex-employee
would retain access to the host's object.

## Consent happens at two levels

The flow has two approvals:

1. Team A asks to connect; an owner or editor of team B responds.
2. A offers object X; B accepts within A's role ceiling.

Acceptance admits the accepter. Without that write, the roster UI would live
inside an object nobody on B could open.

Afterward, B's owner/editors can add or remove B's own members without another
round trip to A. A can remove a participant or revoke the share, but cannot choose
who from B joins. The host approves the organization, object, and maximum role;
the guest organization controls its roster.

Three checks bound that delegation:

- each admitted person must still be a current member of B;
- the assigned role cannot exceed the grant's `viewer` or `editor` ceiling;
- B cannot forward the grant to team C.

For projects, the stored project role remains `guest` even at an editor ceiling.
Using the ordinary editor role would also grant project-member administration,
which is not part of the share.

## Ownership is not the team in the browser

Most existing endpoints accepted `team_id` and used it twice: once to authorize,
then again to filter rows.

A user working from team B's shell can legitimately request a project owned by A.
The ACL check succeeds because the user has a `ProjectMembers` row. The filter
still says `team=B`, so the same request returns an empty task list or a 404.

The repair is an ownership-alignment step before the view:

1. resolve the object by id;
2. run that object's existing access check for the caller;
3. only on success, replace the request's team scope with the object's owning team;
4. leave connection/share endpoints exempt, because their `team_id` means the
   counterparty.

This substitution is not a grant. A caller who cannot access the object gets no
alignment and no additional information. It also keeps writes coherent: a task
created by B inside A's shared project is filed under A, where both sides can find
it.

## Authorization succeeded; the product still looked broken

The first version could authorize all three object types while the receiving team
could not reliably use them.

### Discovery

Lists filtered by owning team. A shared project existed and opened by URL but did
not appear in B's project list. The same was true for chats and note folders.

Each list now returns:

```text
objects I normally see
UNION
objects shared with my current team where I am an admitted participant
```

The second clause is per person, not per connected team. A connection does not
make all of A's objects visible to B, and a grant to B does not admit every member
of B.

Shared rows carry explicit host identity. A note-folder root is re-rooted in B's
sidebar because its real parent may be inaccessible; descendants retain their
actual parent links.

### Requests

Connection requests and share offers are durable inbox rows written by Django.
Live delivery is a separate path:

1. the requester's client emits only a connection, grant, or object id;
2. genos-sockets fetches the pending notice from Django using that caller's JWT;
3. Django returns only notices that caller is allowed to relay;
4. the socket service sends the server-built payload to receiver rooms.

The client is not allowed to supply inbox text or recipients. Otherwise the relay
would be an authenticated arbitrary-notification endpoint.

This path still depends on the requester's socket being connected at creation
time. The inbox row, push, and email do not. Live delivery is an optimization over
durable state, not the durability mechanism.

The first UI integration held a null socket, and background refresh wrote inbox
rows to IndexedDB without repainting the inbox. Both failures looked like backend
authorization bugs. Neither was.

### Cached tasks

Incremental task sync stored a watermark meaning “all rows up to this point are
present.” A project shared after that checkpoint could have old tasks the guest
had never downloaded. Delta sync correctly returned no unchanged rows, leaving a
permanently incomplete local database.

The API now returns the task count the caller should hold for that project. If the
local count is lower, the client drops the checkpoint and performs a full load.
Checking only whether the store is empty is insufficient: one newly created local
task can coexist with hundreds of missing historical rows.

### People

The client cached one team roster. Cross-team senders and assignees therefore
rendered as unknown UUIDs even though the user could read their messages and
tasks.

Roster responses now include people who co-participate with the caller on a
shared object, marked with `isExternal` and their home-team identity. That widens
identity resolution, not admission: every add-member picker removes external
rows, and the server still refuses the action.

A heartbeat may update that cached row's status, but not replace its identity or
team keys. Replacing the row with the heartbeat sender's current shell would move
the person out of the roster that made them visible.

### Presence

The socket service previously broadcast a heartbeat only to the user's own team
rooms. A collaborator in another organization remained “offline” while actively
editing the same work.

Django now computes a presence audience: the user's own teams, host teams where
they participate, and guest teams sharing an object with them. genos-sockets
broadcasts to those team rooms and falls back to the old own-team audience if the
lookup fails.

The room is coarser than the object ACL. Everyone in a connected team room may
receive the presence payload, even though the UI stores and renders it only for
people already present in the authorized roster. The payload includes identity
fields, so this is a real metadata boundary, not merely a rendering detail.
Per-object presence rooms would narrow it.

## What remains true

- A connected team cannot enumerate another team's workspace.
- Graph adjacency, search indexing, presence, and identity lookup do not grant
  object access.
- A host derives ownership from the object, never from request-supplied team data.
- Revocation is destructive cleanup of materialized ACL rows.
- 404 is used when a response would otherwise confirm an inaccessible object.
- The system still relies on application services and endpoint tests, not a
  centrally enforced DRF permission layer or formal verification.

The implementation lesson was not “add sharing.” It was that a cross-tenant
feature has at least four states to keep aligned: consent, materialized
authorization, server discovery, and client replicas. A correct ACL with stale
lists, identities, checkpoints, or socket audiences is still a broken system—and
some distributed-state repairs can accidentally widen the ACL if they are not
kept separate.

Full disclosure: I built this for Genos, a solo-built workspace for chat, tasks,
and collaborative notes. The no-account demo is at https://genosai.dev. The
authorization and distributed-state tradeoffs above are the point of this article.

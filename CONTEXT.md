# Taskyard

A personal board for projects and the agents that work on them. The server may be remote. Another person can be added to a single project.

## Language

**Project**:
A body of work with its own tasks, threads, and git checkout.
_Avoid_: workspace, repo

**Person**:
A username and password on the server. The header and task history show their display name.
_Avoid_: user, account, email

**Owner**:
The person who created a project.
_Avoid_: admin

**Guest**:
A person added to one project by username.
_Avoid_: member, collaborator, user

**Collection**:
A named set of projects kept by one person and used to filter that person's view.
_Avoid_: workspace, tag

**Thread**:
An agent session working a project.
_Avoid_: chat, workspace

## Relationships

- The first **Person** chooses their own password. Every later **Person** is created by someone already signed in, and must set a new password at the next login
- A **Person** owns the **Projects** they create
- An **Owner** can change a **Project**'s settings and who its **Guests** are
- A **Guest** is added to one **Project** by username, and already has an account
- A **Guest** can see that **Project** and work its tasks
- A **Guest** cannot launch a **Thread** or change **Project** settings
- A **Collection** belongs to one **Person**
- A **Project** can sit in more than one of a **Person**'s **Collections**
- The command line on a machine is signed in as one **Person**

## Example dialogue

> **Dev:** "If I add a **Guest** to a **Project**, what do they see?"
> **Domain expert:** "That project. They can work its tasks. They cannot launch a thread."

## Flagged ambiguities

- "Workspace" already means the git worktree an agent is running in. It is not a group of projects.

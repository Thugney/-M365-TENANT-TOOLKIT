# Admin Roles Collector Review

**Collector**: `collectors/Get-AdminRoleData.ps1`  
**Dashboard pages**: Security, Lifecycle

## Status
PASS with fix applied (dashboard alignment)

## Required Dashboard Fields (Admin Roles)
`roleId`, `roleName`, `isHighPrivilege`, `memberCount`,  
`members[].displayName`, `members[].userPrincipalName`,  
`members[].accountEnabled`, `members[].daysSinceLastSignIn`,  
`members[].userId` (used for admin counts and cross-reference)

## Collector Coverage
- All required fields above are produced.
- Fix applied: added `userId` to user members so `Security` page counts and MFA cross-reference align.

## Graph Collection Details
- Endpoints: `GET /directoryRoles`, `GET /directoryRoles/{id}/members`.
- Required scopes: `RoleManagement.Read.Directory`, `Directory.Read.All`.
- Enriches role members with data from `users.json` where available.

## Risks / Notes
- Role members may include **groups** or **service principals**; UI assumes user fields and may show blanks for non-user members.
- `Security` page admin count aggregates `member.userId` without filtering by `memberType`; if a role contains non-user members the count can be slightly off.

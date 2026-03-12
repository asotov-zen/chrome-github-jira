/**
 * Validates that a Jira URL hostname is a plausible Jira instance.
 * Allows *.atlassian.net, *.jira.com, and any hostname that doesn't
 * look like it's trying to exfiltrate data.
 */
function isValidJiraHost(jiraUrl) {
    if (!jiraUrl || typeof jiraUrl !== 'string') return false;

    // Strip any protocol/path that may have been injected
    const hostname = jiraUrl.split('/')[0].split('?')[0].split('#')[0];
    if (hostname !== jiraUrl) return false;

    // Must look like a valid hostname (no spaces, no special chars except dots/hyphens)
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(hostname)) return false;

    return true;
}

/**
 * Validates that a ticket number matches the expected Jira format.
 */
function isValidTicketNumber(ticketNumber) {
    if (!ticketNumber || typeof ticketNumber !== 'string') return false;
    return /^[A-Z0-9]+-[0-9]+$/i.test(ticketNumber);
}

function getUrlFromRequest({ query, jiraUrl, ticketNumber } = {}) {
    if (!isValidJiraHost(jiraUrl)) {
        throw new Error(`Invalid Jira URL: ${jiraUrl}`);
    }

    switch (query) {
        case 'getSession':
            return `https://${jiraUrl}/rest/auth/1/session`;
        case 'getTicketInfo':
            if (!isValidTicketNumber(ticketNumber)) {
                throw new Error(`Invalid ticket number: ${ticketNumber}`);
            }
            return `https://${jiraUrl}/rest/api/latest/issue/${ticketNumber}`;
        default:
            throw new Error(`Invalid request: ${query}`);
    }
}

async function processRequest(url, sendResponse) {
    try {
        const response = await fetch(url, { headers: { accept: 'application/json' } })
        sendResponse(await response.json());
    } catch (e) {
        console.error(`Failed to fetch: ${e.message}`);
        sendResponse({ errors: true, errorMessages: [e.message] });
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Validate that the message comes from this extension
    if (sender.id !== chrome.runtime.id) {
        console.error('Rejected message from unknown sender:', sender.id);
        return false;
    }

    try {
        processRequest(getUrlFromRequest(request), sendResponse);
    } catch (e) {
        console.error(e.message);
        sendResponse({ errors: true, errorMessages: [e.message] });
    }
    return true;
});

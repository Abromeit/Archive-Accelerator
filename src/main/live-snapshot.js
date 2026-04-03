export async function fetchLiveSnapshot(url) {
    const controller = new AbortController();
    const timeout = setTimeout(function () {
        controller.abort();
    }, 30_000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'ArchiveAccelerator/0.1',
                'Accept': 'text/html',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(`Live fetch failed: HTTP ${response.status}`);
        }

        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

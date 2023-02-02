addEventListener('fetch', event => {
	const { request } = event;

	switch (request.method) {
		case 'POST':
			return event.respondWith(handlePOST(request));
		case 'DELETE':
			return event.respondWith(handleDELETE(request));
		default:
			return event.respondWith(handleRequest(request));
	}
});

/**
 * Respond to POST requests with shortened URL creation
 * @param {Request} request
 */
async function handlePOST(request) {
	const psk = request.headers.get('x-preshared-key');
	if (psk !== SECRET_KEY)
		return new Response('Bad key', { status: 403 });

	const shortener = new URL(request.url);
	const data = await request.formData();
	const redirectURL = data.get('url');
	const path = data.get('path');

	if (!redirectURL || !path)
		return new Response("'url' and 'path' must be set", { status: 400 });

	// validate redirectURL is a URL
	try {
		new URL(redirectURL);
	} catch (e) {
		if (e instanceof TypeError) 
			return new Response("'url' must be a valid http url", { status: 400 });
		else throw e;
	};

	// will overwrite current path if it exists
	await LINKS.put(path, redirectURL);
	return new Response(`${shortener}${path}`, {
		status: 201,
	});
}

/**
 * Respond to DELETE requests by deleting the shortlink
 * @param {Request} request
 */
async function handleDELETE(request) {
	const psk = request.headers.get('x-preshared-key');
	if (psk !== SECRET_KEY)
		return new Response('Sorry, bad key.', { status: 403 });

	const url = new URL(request.url);
	const path = url.pathname.split('/')[1];
	if (!path) return new Response(`Please supply a valid path`, { status: 404 });
	if (await LINKS.get(path) == null) return new Response(`Path '${path}' not found`, { status: 404 });
	await LINKS.delete(path);
	return new Response(`${request.url} successfully deleted`, { status: 200 });
}

/**
 * Respond to GET requests with redirects.
 *
 * Authenticated GET requests without a path will return a list of all
 * shortlinks registered with the service.
 * @param {Request} request
 */
async function handleRequest(request) {
	const url = new URL(request.url);
	const path = url.pathname.split('/')[1];
	const host = url.toString().match(/(http[s]?:\/\/)?([^.]*)\.(.*)\//);
	if (!path) {
		// Return list of available shortlinks if user supplies admin credentials.
		const psk = request.headers.get('x-preshared-key');
		if (psk === SECRET_KEY) {
			const { keys } = await LINKS.list();
			let paths = "";
			keys.forEach(element => paths += `${element.name}\n`);
			return new Response(paths, { status: 200 });
		}
		// console.log(`${url} ${path} ${host[1]+host[3]}`);
		return Response.redirect(new URL(host[1]+host[3]), 302);
	}

	const redirectURL = await LINKS.get(path);
	if (redirectURL) return Response.redirect(redirectURL, 302);

	return new Response('url not found', { status: 404 });
}

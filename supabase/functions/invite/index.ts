// Supabase Edge Function: Invite Link Handler
// HTTP 302 redirect to app deep link

Deno.serve((req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing invite code", { status: 400 });
  }

  const deepLink = `parables://plans/invite?code=${code}`;

  // HTTP 302 redirect to the app deep link
  return new Response(null, {
    status: 302,
    headers: {
      "Location": deepLink,
    },
  });
});

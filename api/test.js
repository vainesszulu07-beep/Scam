async function testGetAd(token_id, subid) {

  const response = await fetch("/api/get-ad", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      token_id: token_id,
      subid: subid
    }),
    cache: "no-store"
  });

  const data = await response.json();

  console.log("HTTP Status:", response.status);
  console.log("Response:", data);

  return data;
}

// Supply your actual session credentials:
testGetAd("d1ad682454ade571ff4f4976d53420eb7c1d3f4b751a69ba7125e0125fb8e3b1", "B6891467");

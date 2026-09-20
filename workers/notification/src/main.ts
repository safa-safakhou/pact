const timer = setInterval(() => {}, 60_000);
console.log("PACT notification worker ready; delivery adapters are disabled until configured.");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    clearInterval(timer);
    process.exitCode = 0;
  });

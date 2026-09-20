const timer = setInterval(() => {}, 60_000);
console.log("PACT channel worker ready; Telegram and native adapters are disabled until their tickets enable them.");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    clearInterval(timer);
    process.exitCode = 0;
  });

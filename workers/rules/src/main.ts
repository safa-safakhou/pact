const timer = setInterval(() => {}, 60_000);
console.log("PACT rules worker ready; authoritative clock is not active until PACT-029.");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    clearInterval(timer);
    process.exitCode = 0;
  });

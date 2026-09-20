const timer = setInterval(() => {}, 60_000);
console.log(
  "PACT inference worker ready; model execution is disabled until an explicit bounded-run ticket enables it.",
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    clearInterval(timer);
    process.exitCode = 0;
  });

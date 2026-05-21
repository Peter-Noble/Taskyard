import React from 'react';
import { render, Text, Box } from 'ink';
import chalk from 'chalk';

function App({ serverUrl }: { serverUrl: string }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Taskyard TUI
      </Text>
      <Text>Server: {serverUrl}</Text>
      <Text dimColor>{chalk.gray('Dashboard UI — implemented in Phase 5')}</Text>
      <Text dimColor>Press Ctrl+C to quit</Text>
    </Box>
  );
}

export async function runTui(serverUrl: string): Promise<void> {
  const { waitUntilExit } = render(<App serverUrl={serverUrl} />);
  await waitUntilExit();
}

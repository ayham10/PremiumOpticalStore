const fs = require("fs");
const os = require("os");

const NEAR_LIMIT_RATIO = 0.85;
const PAGE_SIZE = os.pageSize || 4096;

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return null;
  }
}

function bytesToMb(bytes) {
  if (bytes == null || Number.isNaN(bytes)) {
    return null;
  }
  return Math.round(bytes / 1024 / 1024);
}

function parseKeyValueFile(content) {
  const result = {};
  if (!content) {
    return result;
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex === -1) {
      result[trimmed] = true;
      continue;
    }
    const key = trimmed.slice(0, spaceIndex);
    const value = trimmed.slice(spaceIndex + 1);
    const numberValue = Number(value);
    result[key] = Number.isNaN(numberValue) ? value : numberValue;
  }

  return result;
}

function parsePressureFile(content) {
  if (!content) {
    return null;
  }

  const result = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+)\s+avg10=([\d.]+)\s+avg60=([\d.]+)\s+avg300=([\d.]+)\s+total=(\d+)/);
    if (!match) {
      continue;
    }
    result[match[1]] = {
      avg10: Number(match[2]),
      avg60: Number(match[3]),
      avg300: Number(match[4]),
      total: Number(match[5]),
    };
  }
  return Object.keys(result).length > 0 ? result : null;
}

function resolveCgroupDirectory() {
  const cgroupContent = readTextFile("/proc/self/cgroup");
  if (!cgroupContent) {
    return null;
  }

  const v2Match = cgroupContent.match(/^0::(.+)$/m);
  if (v2Match) {
    return `/sys/fs/cgroup${v2Match[1]}`;
  }

  for (const line of cgroupContent.split("\n")) {
    const parts = line.split(":");
    if (parts.length < 3) {
      continue;
    }
    const controllers = parts[1].split(",");
    if (controllers.includes("memory")) {
      return `/sys/fs/cgroup/memory${parts[2]}`;
    }
  }

  return null;
}

function readCgroupV2Memory(cgroupDir) {
  const currentRaw = readTextFile(`${cgroupDir}/memory.current`);
  const maxRaw = readTextFile(`${cgroupDir}/memory.max`);
  const events = parseKeyValueFile(readTextFile(`${cgroupDir}/memory.events`));
  const stat = parseKeyValueFile(readTextFile(`${cgroupDir}/memory.stat`));

  const currentBytes = currentRaw != null ? Number(currentRaw) : null;
  const maxBytes =
    maxRaw == null || maxRaw === "max" ? null : Number(maxRaw);

  const utilizationPct =
    currentBytes != null && maxBytes != null && maxBytes > 0
      ? Math.round((currentBytes / maxBytes) * 1000) / 10
      : null;

  return {
    version: 2,
    path: cgroupDir,
    currentBytes,
    currentMb: bytesToMb(currentBytes),
    maxBytes,
    maxMb: maxBytes == null ? null : bytesToMb(maxBytes),
    maxRaw: maxRaw ?? null,
    utilizationPct,
    nearLimit:
      utilizationPct != null ? utilizationPct >= NEAR_LIMIT_RATIO * 100 : null,
    events: {
      low: events.low ?? null,
      high: events.high ?? null,
      max: events.max ?? null,
      oom: events.oom ?? null,
      oom_kill: events.oom_kill ?? null,
    },
    stat: {
      anonMb: bytesToMb(stat.anon),
      fileMb: bytesToMb(stat.file),
      kernelMb: bytesToMb(stat.kernel),
      slabMb: bytesToMb(stat.slab),
      shmemMb: bytesToMb(stat.shmem),
    },
  };
}

function readCgroupV1Memory(cgroupDir) {
  const currentRaw =
    readTextFile(`${cgroupDir}/memory.usage_in_bytes`) ||
    readTextFile(`${cgroupDir}/memory.current`);
  const maxRaw =
    readTextFile(`${cgroupDir}/memory.limit_in_bytes`) ||
    readTextFile(`${cgroupDir}/memory.max`);
  const eventsRaw = readTextFile(`${cgroupDir}/memory.events`);
  const statRaw =
    readTextFile(`${cgroupDir}/memory.stat`) ||
    readTextFile(`${cgroupDir}/memory.stat.local`);

  const currentBytes = currentRaw != null ? Number(currentRaw) : null;
  let maxBytes = maxRaw != null ? Number(maxRaw) : null;
  if (maxBytes != null && maxBytes > 1 << 60) {
    maxBytes = null;
  }

  const events = parseKeyValueFile(eventsRaw);
  const stat = parseKeyValueFile(statRaw);
  const oomControl = readTextFile(`${cgroupDir}/memory.oom_control`);

  const utilizationPct =
    currentBytes != null && maxBytes != null && maxBytes > 0
      ? Math.round((currentBytes / maxBytes) * 1000) / 10
      : null;

  return {
    version: 1,
    path: cgroupDir,
    currentBytes,
    currentMb: bytesToMb(currentBytes),
    maxBytes,
    maxMb: maxBytes == null ? null : bytesToMb(maxBytes),
    maxRaw: maxBytes == null ? "max" : String(maxBytes),
    utilizationPct,
    nearLimit:
      utilizationPct != null ? utilizationPct >= NEAR_LIMIT_RATIO * 100 : null,
    events: {
      low: events.low ?? null,
      high: events.high ?? null,
      max: events.max ?? null,
      oom: events.oom ?? events.under_oom ?? null,
      oom_kill: events.oom_kill ?? null,
      oomControl: oomControl ?? null,
    },
    stat: {
      anonMb: bytesToMb(stat.anon ?? stat.total_rss),
      fileMb: bytesToMb(stat.file ?? stat.cache),
      kernelMb: bytesToMb(stat.kernel),
      slabMb: bytesToMb(stat.slab),
      shmemMb: bytesToMb(stat.shmem),
    },
  };
}

function readCgroupMemorySnapshot() {
  const cgroupDir = resolveCgroupDirectory();
  if (!cgroupDir) {
    return {
      available: false,
      error: "Could not resolve cgroup directory from /proc/self/cgroup",
    };
  }

  if (fs.existsSync(`${cgroupDir}/memory.current`)) {
    return { available: true, ...readCgroupV2Memory(cgroupDir) };
  }

  if (
    fs.existsSync(`${cgroupDir}/memory.usage_in_bytes`) ||
    fs.existsSync(`${cgroupDir}/memory.limit_in_bytes`)
  ) {
    return { available: true, ...readCgroupV1Memory(cgroupDir) };
  }

  return {
    available: false,
    path: cgroupDir,
    error: "No cgroup memory files found",
  };
}

function readPressureSnapshot(cgroupDir) {
  const baseDir = cgroupDir || resolveCgroupDirectory();
  if (!baseDir) {
    return null;
  }

  const memoryPressure = parsePressureFile(
    readTextFile(`${baseDir}/memory.pressure`),
  );
  const cpuPressure = parsePressureFile(readTextFile(`${baseDir}/cpu.pressure`));

  if (!memoryPressure && !cpuPressure) {
    return null;
  }

  return {
    memory: memoryPressure,
    cpu: cpuPressure,
  };
}

function listChildPids(pid) {
  const childrenFile = `/proc/${pid}/task/${pid}/children`;
  const childrenRaw = readTextFile(childrenFile);
  if (childrenRaw) {
    return childrenRaw
      .split(/\s+/)
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  const children = [];
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) {
      continue;
    }
    const childPid = Number(entry);
    const status = readTextFile(`/proc/${childPid}/status`);
    if (!status) {
      continue;
    }
    const ppidMatch = status.match(/^PPid:\s+(\d+)/m);
    if (ppidMatch && Number(ppidMatch[1]) === pid) {
      children.push(childPid);
    }
  }
  return children;
}

function collectProcessTree(rootPid) {
  if (!rootPid) {
    return [];
  }

  const queue = [rootPid];
  const seen = new Set();
  const ordered = [];

  while (queue.length > 0) {
    const pid = queue.shift();
    if (seen.has(pid)) {
      continue;
    }
    seen.add(pid);
    ordered.push(pid);
    queue.push(...listChildPids(pid));
  }

  return ordered;
}

function readProcessCmdline(pid) {
  const raw = readTextFile(`/proc/${pid}/cmdline`);
  if (!raw) {
    return null;
  }
  return raw.replace(/\0/g, " ").trim() || null;
}

function readProcessStatField(pid, fieldName) {
  const status = readTextFile(`/proc/${pid}/status`);
  if (!status) {
    return null;
  }
  const match = status.match(new RegExp(`^${fieldName}:\\s+(\\S+)`, "m"));
  return match ? match[1] : null;
}

function readProcessRssKb(pid) {
  const statm = readTextFile(`/proc/${pid}/statm`);
  if (!statm) {
    return null;
  }
  const parts = statm.split(/\s+/);
  if (parts.length < 2) {
    return null;
  }
  const rssPages = Number(parts[1]);
  if (!Number.isFinite(rssPages)) {
    return null;
  }
  return Math.round((rssPages * PAGE_SIZE) / 1024);
}

function inferChromeProcessType(cmdline, isRoot) {
  if (!cmdline) {
    return "unknown";
  }
  const typeMatch = cmdline.match(/--type=([^\s]+)/);
  if (typeMatch) {
    return typeMatch[1];
  }
  if (isRoot) {
    return "browser";
  }
  if (/chrome|chromium|Google Chrome/i.test(cmdline)) {
    return "chrome-other";
  }
  return "other";
}

function collectChromeProcessTree(browserPid) {
  if (!browserPid) {
    return {
      browserPid: null,
      processCount: 0,
      totalRssMb: 0,
      processes: [],
    };
  }

  const pids = collectProcessTree(browserPid);
  const processes = pids.map((pid) => {
    const cmdline = readProcessCmdline(pid);
    const rssKb = readProcessRssKb(pid);
    return {
      pid,
      type: inferChromeProcessType(cmdline, pid === browserPid),
      rssMb: rssKb == null ? null : Math.round(rssKb / 1024),
      stat: readProcessStatField(pid, "State"),
      command: cmdline ? cmdline.slice(0, 160) : null,
    };
  });

  const totalRssKb = processes.reduce(
    (sum, process) => sum + (process.rssMb != null ? process.rssMb * 1024 : 0),
    0,
  );

  return {
    browserPid,
    processCount: processes.length,
    totalRssMb: Math.round(totalRssKb / 1024),
    processes,
  };
}

function collectNodeMemorySnapshot() {
  const memory = process.memoryUsage();
  return {
    rssMb: Math.round(memory.rss / 1024 / 1024),
    heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    externalMb: Math.round(memory.external / 1024 / 1024),
  };
}

function collectContainerResourceSnapshot(activeClient) {
  const cgroup = readCgroupMemorySnapshot();
  const browserProcess =
    activeClient?.pupBrowser && typeof activeClient.pupBrowser.process === "function"
      ? activeClient.pupBrowser.process()
      : null;
  const browserPid = browserProcess?.pid ?? null;
  const chrome = collectChromeProcessTree(browserPid);
  const node = collectNodeMemorySnapshot();
  const pressure = readPressureSnapshot(cgroup.path);

  const combinedRssMb = node.rssMb + chrome.totalRssMb;

  return {
    timestamp: new Date().toISOString(),
    node,
    cgroup,
    pressure,
    chrome,
    combinedRssMb,
  };
}

function summarizeContainerResources(snapshot) {
  return {
    nodeRssMb: snapshot.node.rssMb,
    cgroupCurrentMb: snapshot.cgroup.currentMb ?? null,
    cgroupMaxMb: snapshot.cgroup.maxMb ?? null,
    cgroupMaxRaw: snapshot.cgroup.maxRaw ?? null,
    cgroupUtilizationPct: snapshot.cgroup.utilizationPct ?? null,
    cgroupNearLimit: snapshot.cgroup.nearLimit ?? null,
    cgroupOom: snapshot.cgroup.events?.oom ?? null,
    cgroupOomKill: snapshot.cgroup.events?.oom_kill ?? null,
    cgroupAnonMb: snapshot.cgroup.stat?.anonMb ?? null,
    chromeProcessCount: snapshot.chrome.processCount,
    chromeTreeRssMb: snapshot.chrome.totalRssMb,
    combinedRssMb: snapshot.combinedRssMb,
    cpuPressureSomeAvg10: snapshot.pressure?.cpu?.some?.avg10 ?? null,
    memoryPressureSomeAvg10: snapshot.pressure?.memory?.some?.avg10 ?? null,
  };
}

function logContainerResources(activeClient, eventLabel) {
  const snapshot = collectContainerResourceSnapshot(activeClient);
  console.info("[whatsapp-web] container resources", {
    event: eventLabel,
    ...summarizeContainerResources(snapshot),
    cgroupPath: snapshot.cgroup.path ?? null,
    cgroupEvents: snapshot.cgroup.events ?? null,
    chromeProcesses: snapshot.chrome.processes,
  });
  return snapshot;
}

module.exports = {
  NEAR_LIMIT_RATIO,
  collectChromeProcessTree,
  collectContainerResourceSnapshot,
  logContainerResources,
  readCgroupMemorySnapshot,
  summarizeContainerResources,
};

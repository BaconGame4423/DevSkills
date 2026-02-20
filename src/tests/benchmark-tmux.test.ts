/**
 * benchmark-tmux.test.ts
 *
 * tmux ユーティリティ関数のテスト。
 *
 * テスト対象: src/lib/benchmark/tmux.ts
 * - capturePaneContent
 * - sendKeys
 * - sendKeysLiteral
 * - pasteBuffer
 * - splitWindow
 * - listPanes
 * - killPane
 * - paneExists
 *
 * child_process.execSync を vi.mock でモックして実際の tmux は呼ばない。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// node:child_process をモック
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";

// テスト対象の関数をインポート（モック適用後）
const mockedExecSync = vi.mocked(execSync);

// テスト対象モジュールを動的インポート
async function importTmux() {
  return import("../lib/benchmark/tmux.js");
}

describe("tmux utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------
  // capturePaneContent
  // ---------------------------------------------------------------

  describe("capturePaneContent", () => {
    it("正しい tmux コマンドで execSync が呼ばれる", async () => {
      const expectedContent = "pane content line 1\npane content line 2";
      mockedExecSync.mockReturnValue(expectedContent);

      const { capturePaneContent } = await importTmux();
      const result = capturePaneContent("test-pane");

      expect(mockedExecSync).toHaveBeenCalledWith(
        "tmux capture-pane -t test-pane -p",
        expect.any(Object)
      );
      expect(result).toBe(expectedContent);
    });

    it("ペイン ID が正しくエスケープされる", async () => {
      mockedExecSync.mockReturnValue("content");

      const { capturePaneContent } = await importTmux();
      capturePaneContent("my-pane:0.1");

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("-t my-pane:0.1"),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // sendKeys
  // ---------------------------------------------------------------

  describe("sendKeys", () => {
    it("正しいコマンドが実行される", async () => {
      mockedExecSync.mockReturnValue("");

      const { sendKeys } = await importTmux();
      sendKeys("test-pane", "Enter");

      expect(mockedExecSync).toHaveBeenCalledWith(
        "tmux send-keys -t test-pane Enter",
        expect.any(Object)
      );
    });

    it("複数キーを送信できる", async () => {
      mockedExecSync.mockReturnValue("");

      const { sendKeys } = await importTmux();
      sendKeys("test-pane", "C-c");

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("C-c"),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // sendKeysLiteral
  // ---------------------------------------------------------------

  describe("sendKeysLiteral", () => {
    it("リテラルテキストとして送信する", async () => {
      mockedExecSync.mockReturnValue("");

      const { sendKeysLiteral } = await importTmux();
      sendKeysLiteral("test-pane", "echo 'hello world'");

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("-l"),
        expect.any(Object)
      );
      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("echo 'hello world'"),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // pasteBuffer
  // ---------------------------------------------------------------

  describe("pasteBuffer", () => {
    it("set-buffer + paste-buffer の 2 コマンドが順番に実行される", async () => {
      mockedExecSync.mockReturnValue("");

      const { pasteBuffer } = await importTmux();
      pasteBuffer("test-pane", "test-buffer", "multi\nline\ntext");

      // 2回呼ばれることを確認
      expect(mockedExecSync).toHaveBeenCalledTimes(2);

      // 1回目: set-buffer
      expect(mockedExecSync).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("set-buffer"),
        expect.any(Object)
      );

      // 2回目: paste-buffer
      expect(mockedExecSync).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("paste-buffer"),
        expect.any(Object)
      );
    });

    it("バッファ名とテキストが正しく渡される", async () => {
      mockedExecSync.mockReturnValue("");

      const { pasteBuffer } = await importTmux();
      pasteBuffer("my-pane", "my-buffer", "test content");

      const calls = mockedExecSync.mock.calls;
      const setBufferCall = calls[0]?.[0] as string;
      const pasteBufferCall = calls[1]?.[0] as string;

      expect(setBufferCall).toContain("my-buffer");
      expect(pasteBufferCall).toContain("-t my-pane");
    });
  });

  // ---------------------------------------------------------------
  // splitWindow
  // ---------------------------------------------------------------

  describe("splitWindow", () => {
    it("正しいオプションが渡される（デフォルト）", async () => {
      mockedExecSync.mockReturnValue("new-pane-id");

      const { splitWindow } = await importTmux();
      const result = splitWindow({});

      expect(mockedExecSync).toHaveBeenCalledWith(
        "tmux split-window -P -F #{pane_id}",
        expect.any(Object)
      );
      expect(result).toBe("new-pane-id");
    });

    it("垂直分割オプションが渡される", async () => {
      mockedExecSync.mockReturnValue("new-pane-id");

      const { splitWindow } = await importTmux();
      splitWindow({ vertical: true });

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("-v"),
        expect.any(Object)
      );
    });

    it("ターゲットペインが指定される", async () => {
      mockedExecSync.mockReturnValue("new-pane-id");

      const { splitWindow } = await importTmux();
      splitWindow({ targetPane: "source-pane" });

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("-t source-pane"),
        expect.any(Object)
      );
    });

    it("パーセンテージが指定される", async () => {
      mockedExecSync.mockReturnValue("new-pane-id");

      const { splitWindow } = await importTmux();
      splitWindow({ percentage: 50 });

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("-p 50"),
        expect.any(Object)
      );
    });

    it("全オプションを組み合わせて使用できる", async () => {
      mockedExecSync.mockReturnValue("new-pane-id");

      const { splitWindow } = await importTmux();
      splitWindow({ vertical: true, targetPane: "main", percentage: 30 });

      const call = mockedExecSync.mock.calls[0]?.[0] as string;
      expect(call).toContain("-v");
      expect(call).toContain("-t main");
      expect(call).toContain("-p 30");
    });
  });

  // ---------------------------------------------------------------
  // listPanes
  // ---------------------------------------------------------------

  describe("listPanes", () => {
    it("ペイン一覧を配列で返す", async () => {
      mockedExecSync.mockReturnValue("pane0\npane1\npane2");

      const { listPanes } = await importTmux();
      const result = listPanes();

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("list-panes"),
        expect.any(Object)
      );
      expect(result).toEqual(["pane0", "pane1", "pane2"]);
    });

    it("空の結果の場合は空配列を返す", async () => {
      mockedExecSync.mockReturnValue("");

      const { listPanes } = await importTmux();
      const result = listPanes();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // killPane
  // ---------------------------------------------------------------

  describe("killPane", () => {
    it("指定されたペインを削除する", async () => {
      mockedExecSync.mockReturnValue("");

      const { killPane } = await importTmux();
      killPane("target-pane");

      expect(mockedExecSync).toHaveBeenCalledWith(
        "tmux kill-pane -t target-pane",
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------
  // paneExists
  // ---------------------------------------------------------------

  describe("paneExists", () => {
    it("正常時 true を返す", async () => {
      // list-panes の出力にペインIDが含まれていればtrue
      mockedExecSync.mockReturnValue("existing-pane\nother-pane\n");

      const { paneExists } = await importTmux();
      const result = paneExists("existing-pane");

      expect(result).toBe(true);
    });

    it("エラー時 false を返す", async () => {
      // ペインが存在しない場合、tmux はエラーを投げる
      mockedExecSync.mockImplementation(() => {
        throw new Error("can't find pane: non-existent-pane");
      });

      const { paneExists } = await importTmux();
      const result = paneExists("non-existent-pane");

      expect(result).toBe(false);
    });

    it("任意のエラーで false を返す", async () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("some tmux error");
      });

      const { paneExists } = await importTmux();
      const result = paneExists("any-pane");

      expect(result).toBe(false);
    });
  });
});

'use strict';
import * as vscode from 'vscode';
import {Tests, TestsToRun, TestFolder, TestFile, TestStatus, TestSuite, TestFunction, CANCELLATION_REASON} from '../contracts';
import {PythonSettings} from '../../common/configSettings';

const settings = PythonSettings.getInstance();

export class TestResultDisplay {
    private statusBar: vscode.StatusBarItem;
    constructor(private outputChannel: vscode.OutputChannel) {
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }
    public dispose() {
        this.statusBar.dispose();
    }
    public DisplayProgressStatus(tests: Promise<Tests>) {
        this.displayProgress('Running Tests', 'Running Python Unit Tests (Click to Stop)', 'python.stopUnitTests');
        tests
            .then(this.updateTestRunWithSuccess.bind(this))
            .catch(this.updateTestRunWithFailure.bind(this))
            // We don't care about any other exceptions returned by updateTestRunWithFailure
            .catch(() => { });
    }

    private updateTestRunWithSuccess(tests: Tests): Tests {
        this.clearProgressTicker();

        // Treat errors as a special case, as we generally wouldn't have any errors
        const statusText = [];
        const toolTip = [];
        if (tests.summary.passed > 0) {
            statusText.push(`$(check) ${tests.summary.passed}`);
            toolTip.push(`${tests.summary.passed} Passed`);
        }
        if (tests.summary.failures > 0) {
            statusText.push(`$(alert) ${tests.summary.failures}`);
            toolTip.push(`${tests.summary.failures} Failed`);
        }
        if (tests.summary.errors > 0) {
            statusText.push(`$(x) ${tests.summary.errors}`);
            toolTip.push(`${tests.summary.errors} Error${tests.summary.errors > 1 ? 's' : ''}`);
        }
        if (tests.summary.skipped > 0) {
            statusText.push(`$(circle-slash) ${tests.summary.skipped}`);
            toolTip.push(`${tests.summary.skipped} Skipped`);
        }
        this.statusBar.tooltip = toolTip.length === 0 ? 'No Python Unit Tests Ran' : toolTip.join(', ') + ' (Python Unit Tests)';
        this.statusBar.text = statusText.length === 0 ? 'No Tests Ran' : statusText.join(' ');
        this.statusBar.command = 'python.viewTests';
        this.statusBar.show();
        return tests;
    }

    private updateTestRunWithFailure(reason: any): Promise<any> {
        this.clearProgressTicker();
        this.statusBar.command = 'python.viewTests';
        if (reason === CANCELLATION_REASON) {
            this.statusBar.text = '$(triangle-right) Run Tests';
            this.statusBar.tooltip = 'Run Python Unit Tests';
        }
        else {
            this.statusBar.text = `$(octicon-alert) Tests Failed`;
            this.statusBar.tooltip = 'Running Python Unit Tests Failed';
            vscode.window.showErrorMessage('There was an error in running the unit tests.');
        }
        this.statusBar.show();
        return Promise.reject(reason);
    }

    private discoverCounter = 0;
    private ticker = ['|', '/', '-', '|', '/', '-', '\\'];
    private progressTimeout;
    private progressPrefix: string;
    private displayProgress(message: string, tooltip: string, command: string) {
        this.progressPrefix = this.statusBar.text = '$(stop) ' + message;
        this.statusBar.command = command;
        this.statusBar.tooltip = tooltip;
        this.statusBar.show();
        this.clearProgressTicker();
        this.progressTimeout = setInterval(() => this.updateProgressTicker(), 150);
    }
    private updateProgressTicker() {
        let text = `${this.progressPrefix} ${this.ticker[this.discoverCounter % 7]}`;
        this.discoverCounter += 1;
        this.statusBar.text = text;
    }
    private clearProgressTicker() {
        if (this.progressTimeout) {
            clearInterval(this.progressTimeout);
        }
        this.progressTimeout = null;
        this.discoverCounter = 0;
    }

    public DisplayDiscoverStatus(tests: Promise<Tests>) {
        this.displayProgress('Discovering Tests', 'Discovering Python Unit Tests (Click to Stop)', 'python.stopUnitTests');
        return tests.then(tests => {
            this.updateWithDiscoverSuccess(tests);
            return tests;
        }).catch(reason => {
            this.updateWithDiscoverFailure(reason);
            return Promise.reject(reason);
        });
    }

    private updateWithDiscoverSuccess(tests: Tests) {
        this.clearProgressTicker();
        const haveTests = tests && (tests.testFunctions.length > 0);
        this.statusBar.text = haveTests ? '$(triangle-right) Run Tests' : 'No Unit Tests';
        this.statusBar.tooltip = haveTests ? 'Run Python Unit Tests' : 'No Python Unit Tests discovered';
        this.statusBar.command = haveTests ? 'python.viewTests' : 'python.discoverTests';
        this.statusBar.show();
    }

    private updateWithDiscoverFailure(reason: any) {
        this.clearProgressTicker();
        this.statusBar.text = `$(triangle-right) Discover Tests`;
        this.statusBar.tooltip = 'Discover Python Unit Tests';
        this.statusBar.command = 'python.discoverTests';
        this.statusBar.show();
        if (reason !== CANCELLATION_REASON) {
            vscode.window.showErrorMessage('There was an error in discovering unit tests');
        }
    }
}
// =====================================================================
//  Jenkinsfile : Playwright test pipeline (Declarative, Windows agent)
//  Every section has a comment saying WHAT it does and WHY.
//  Windows uses `bat`. On Linux/Mac, replace `bat` with `sh`.
// =====================================================================

// ---------------------------------------------------------------------
// 1. HELPER FUNCTIONS (plain Groovy code placed outside `pipeline {}`)
//    Use these to avoid repeating logic.
// ---------------------------------------------------------------------

// Maps the ENVIRONMENT choice to a base URL. Replace with your real URLs.
def baseUrlFor(String envName) {
    def urls = [
        qa     : 'https://www.saucedemo.com',
        staging: 'https://www.saucedemo.com',
        prod   : 'https://www.saucedemo.com'
    ]
    return urls[envName]
}

// Builds the `npx playwright test ...` command from options.
def pwCommand(Map o) {
    def cmd = 'npx playwright test'
    if (o.project)   { cmd += " --project=${o.project}" }
    if (o.workers)   { cmd += " --workers=${o.workers}" }
    if (o.retries)   { cmd += " --retries=${o.retries}" }
    if (o.grep)      { cmd += " --grep \"${o.grep}\"" }
    if (o.shard)     { cmd += " --shard=${o.shard}" }
    if (o.output)    { cmd += " --output=${o.output}" }
    if (o.headed)    { cmd += ' --headed' }
    if (o.reporter)  { cmd += " --reporter=${o.reporter}" }
    return cmd
}

pipeline {

    // -----------------------------------------------------------------
    // 2. AGENT: where the pipeline runs.
    //    `any` = any available executor (your laptop here).
    //    Other examples:
    //      agent { label 'windows-node' }   // a specific agent by label
    //      agent { docker { image 'mcr.microsoft.com/playwright:v1.48.0-jammy' } } // Linux + Docker
    // -----------------------------------------------------------------
    agent any

    // -----------------------------------------------------------------
    // 3. OPTIONS: behaviour of the whole pipeline.
    // -----------------------------------------------------------------
    options {
        timestamps()                                   // time on every console line (Timestamper plugin)
        timeout(time: 60, unit: 'MINUTES')             // kill the build if it hangs
        buildDiscarder(logRotator(numToKeepStr: '20', // keep the last 20 builds
                                  artifactNumToKeepStr: '5')) // artifacts of the last 5
        disableConcurrentBuilds()                      // never run two builds of this job together
        skipDefaultCheckout(true)                      // we do the checkout ourselves, see Prepare stage
    }

    // -----------------------------------------------------------------
    // 4. TRIGGERS: when the build starts automatically.
    // -----------------------------------------------------------------
    triggers {
        pollSCM('H/5 * * * *')                         // check GitHub every ~5 min (works on localhost)
        // cron('H 2 * * 1-5')                         // nightly at ~2 AM, Mon-Fri (uncomment to use)
    }

    // -----------------------------------------------------------------
    // 5. PARAMETERS: the "Build with Parameters" form.
    //    The form appears after the first build that has this Jenkinsfile.
    // -----------------------------------------------------------------
    parameters {
        choice(name: 'ENVIRONMENT', choices: ['qa', 'staging', 'prod'],
               description: 'Which environment to test')
        choice(name: 'BROWSER', choices: ['chromium', 'firefox', 'webkit', 'all'],
               description: 'Browser project. "all" runs every project in playwright.config.ts')
        string(name: 'TAG', defaultValue: '',
               description: 'Run only tests whose title has this tag, e.g. @smoke or @regression (empty = all)')
        choice(name: 'SHARDS', choices: ['1', '2', '3', '4'],
               description: '1 = no sharding. 2+ = split the suite into that many parallel shards')
        string(name: 'WORKERS', defaultValue: '2',
               description: 'Parallel workers per shard (keep low on a laptop)')
        string(name: 'RETRIES', defaultValue: '1',
               description: 'Retry failed tests this many times')
        booleanParam(name: 'HEADED', defaultValue: false,
               description: 'Show the browser (only works if Jenkins runs as a desktop user, not a service)')
        booleanParam(name: 'RUN_TYPECHECK', defaultValue: false,
               description: 'Run TypeScript type check before tests')
        booleanParam(name: 'ENABLE_ALLURE', defaultValue: false,
               description: 'Generate Allure results (needs: npm i -D allure-playwright + Allure Jenkins plugin)')
        booleanParam(name: 'CLEAN_WORKSPACE', defaultValue: false,
               description: 'Delete the workspace after the build')
    }

    // -----------------------------------------------------------------
    // 6. ENVIRONMENT: variables available to every stage and to your tests
    //    (read in tests with process.env.NAME).
    // -----------------------------------------------------------------
    environment {
        CI                   = 'true'       // Playwright switches to CI-friendly behaviour
        PLAYWRIGHT_HTML_OPEN = 'never'      // never try to open the HTML report (would hang Jenkins)
        FORCE_COLOR          = '0'          // no colour codes in console output

        // Secrets example (create a "Secret text" credential with ID app-password first):
        // APP_PASSWORD = credentials('app-password')
    }

    stages {

        // -------------------------------------------------------------
        // STAGE 1: Prepare: checkout code, set variables, clean old output
        // -------------------------------------------------------------
        stage('Prepare') {
            steps {
                checkout scm                                   // get the code from GitHub
                script {
                    env.BASE_URL = baseUrlFor(params.ENVIRONMENT)
                    env.TEST_ENV = params.ENVIRONMENT
                    // Nice build label in the Jenkins UI, e.g. "#7 qa chromium"
                    currentBuild.displayName = "#${env.BUILD_NUMBER} ${params.ENVIRONMENT} ${params.BROWSER}"
                    currentBuild.description = "Tag: ${params.TAG ?: 'all'} | Shards: ${params.SHARDS}"
                }
                echo "Testing ${env.BASE_URL} (${env.TEST_ENV})"
                // Remove leftovers from previous runs
                bat '''
                    if exist test-results     rmdir /s /q test-results
                    if exist playwright-report rmdir /s /q playwright-report
                    if exist blob-report      rmdir /s /q blob-report
                    if exist allure-results   rmdir /s /q allure-results
                    if exist results          rmdir /s /q results
                '''
            }
        }

        // -------------------------------------------------------------
        // STAGE 2: Approval gate. Runs ONLY for prod (`when` = condition)
        // -------------------------------------------------------------
        stage('Approve prod run') {
            when { expression { params.ENVIRONMENT == 'prod' } }
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    input message: 'You are about to run tests against PROD. Continue?', ok: 'Yes, run'
                }
            }
        }

        // -------------------------------------------------------------
        // STAGE 3: Install dependencies and browsers
        // -------------------------------------------------------------
        stage('Install') {
            steps {
                bat 'node -v && npm -v'
                bat 'npm ci'                                   // exact versions from package-lock.json
                script {
                    if (params.BROWSER == 'all') {
                        bat 'npx playwright install'           // all browsers
                    } else {
                        bat "npx playwright install ${params.BROWSER}"   // only the one needed
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // STAGE 4 (optional): static check before spending time on tests
        // -------------------------------------------------------------
        stage('Type check') {
            when { expression { params.RUN_TYPECHECK } }
            steps { bat 'npx tsc --noEmit' }
        }

        // -------------------------------------------------------------
        // STAGE 5: Run the tests (single run OR parallel shards)
        //   catchError: if tests fail, mark build UNSTABLE and CONTINUE,
        //   so reports are still merged and published.
        // -------------------------------------------------------------
        stage('Run tests') {
            steps {
                catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                    script {
                        int shards  = params.SHARDS.toInteger()
                        def project = (params.BROWSER == 'all') ? '' : params.BROWSER

                        if (shards == 1) {
                            // ---- Normal run ----
                            def reporters = params.ENABLE_ALLURE ? 'list,html,junit,allure-playwright' : 'list,html,junit'
                            withEnv(['PLAYWRIGHT_JUNIT_OUTPUT_NAME=results/junit.xml']) {
                                bat pwCommand(project: project, workers: params.WORKERS, retries: params.RETRIES,
                                              grep: params.TAG, headed: params.HEADED, reporter: reporters)
                            }
                        } else {
                            // ---- Sharded run: N shards run side by side ----
                            // Each shard writes a "blob" report; they are merged in the next stage.
                            def reporters = params.ENABLE_ALLURE ? 'blob,allure-playwright' : 'blob'
                            def branches = [:]
                            for (int i = 1; i <= shards; i++) {
                                int n = i                                  // copy: closures need their own variable
                                branches["shard ${n}/${shards}"] = {
                                    bat pwCommand(project: project, workers: params.WORKERS, retries: params.RETRIES,
                                                  grep: params.TAG, shard: "${n}/${shards}",
                                                  output: "test-results\\shard-${n}", reporter: reporters)
                                }
                            }
                            branches.failFast = false                      // let all shards finish even if one fails
                            parallel branches
                        }
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // STAGE 6: Merge shard reports into ONE HTML + JUnit report
        // -------------------------------------------------------------
        stage('Merge shard reports') {
            when { expression { params.SHARDS.toInteger() > 1 } }
            steps {
                withEnv(['PLAYWRIGHT_JUNIT_OUTPUT_NAME=results/junit.xml']) {
                    bat 'npx playwright merge-reports --reporter=html,junit ./blob-report'
                }
            }
        }
    }

    // -----------------------------------------------------------------
    // 7. POST: runs after the stages, whatever the result.
    //    Conditions: always, success, unstable, failure, aborted, changed, cleanup
    // -----------------------------------------------------------------
    post {
        always {
            // JUnit results feed Jenkins' "Test Result" page and trend graph
            junit testResults: 'results/junit.xml', allowEmptyResults: true

            // Save files so you can download them from the build page
            archiveArtifacts artifacts: 'playwright-report/**, test-results/**, results/**, allure-results/**',
                             allowEmptyArchive: true

            script {
                // Playwright HTML report as a link on the build page (HTML Publisher plugin)
                try {
                    publishHTML(target: [
                        allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
                        reportDir: 'playwright-report', reportFiles: 'index.html',
                        reportName: 'Playwright Report'
                    ])
                } catch (err) {
                    echo 'HTML Publisher plugin not installed, skipping.'
                }

                // Allure report (Allure Jenkins plugin + a tool named in Manage Jenkins > Tools)
                if (params.ENABLE_ALLURE) {
                    try {
                        allure includeProperties: false, jdk: '', results: [[path: 'allure-results']]
                    } catch (err) {
                        echo 'Allure plugin not configured, skipping.'
                    }
                }
            }
        }
        success  { echo 'All tests passed.' }
        unstable { echo 'Some tests failed. Open the reports.' }
        failure  { echo 'Pipeline itself failed (install/checkout/config problem).' }

        // Email example (needs Email Extension plugin + SMTP set in Manage Jenkins > System):
        // failure { emailext subject: "FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
        //                    body: "See ${env.BUILD_URL}", to: 'team@example.com' }

        cleanup {
            script {
                if (params.CLEAN_WORKSPACE) {
                    try { cleanWs() } catch (err) { echo 'Workspace Cleanup plugin not installed, skipping.' }
                }
            }
        }
    }
}
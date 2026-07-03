/**
 * Hand-rolled interactive prompts (zero-dep): styled text questions via
 * readline and an arrow-key select for enumerable choices
 */

import * as readline from 'node:readline'
import { createInterface } from 'node:readline/promises'
import type { Key } from 'node:readline'

export interface SelectChoice<T extends string> {
    value: T
    label: string
    hint?: string
}

export interface Prompter {
    text(label: string, defaultValue: string): Promise<string>
    select<T extends string>(
        label: string,
        choices: Array<SelectChoice<T>>,
        defaultValue: T,
    ): Promise<T>
}

const colorEnabled =
    process.stdout.isTTY === true && process.env.NO_COLOR === undefined

const paint =
    (open: string) =>
    (s: string): string =>
        colorEnabled ? `\x1b[${open}m${s}\x1b[0m` : s

export const bold = paint('1')
export const dim = paint('2')
export const cyan = paint('36')
export const green = paint('32')
export const yellow = paint('33')

function abort(): never {
    process.stdout.write('\x1b[?25h')
    console.error('\nAborted.')
    process.exit(130)
}

const EOF = Symbol('eof')

async function textPrompt(
    label: string,
    defaultValue: string,
): Promise<string> {
    const question = `${cyan('?')} ${bold(label)} ${dim(`(${defaultValue})`)}: `
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    rl.on('SIGINT', () => {
        rl.close()
        abort()
    })
    // EOF (Ctrl+D) resolves to the empty answer, i.e. the default
    const closed = new Promise<typeof EOF>(resolve =>
        rl.once('close', () => resolve(EOF)),
    )
    let answer: string | typeof EOF
    try {
        answer = await Promise.race([
            rl.question(question).catch((): typeof EOF => EOF),
            closed,
        ])
    } finally {
        rl.close()
    }
    if (answer === EOF) {
        process.stdout.write('\n')
        return ''
    }
    if (process.stdout.isTTY) {
        process.stdout.write(
            `\x1b[1A\x1b[2K${green('✔')} ${bold(label)}: ${cyan(answer.trim() || defaultValue)}\n`,
        )
    }
    return answer
}

function selectPrompt<T extends string>(
    label: string,
    choices: Array<SelectChoice<T>>,
    defaultValue: T,
): Promise<T> {
    const stdin = process.stdin
    const stdout = process.stdout
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
        return Promise.resolve(defaultValue)
    }

    let index = Math.max(
        0,
        choices.findIndex(choice => choice.value === defaultValue),
    )
    const lineCount = choices.length + 1

    const render = (repaint: boolean): void => {
        if (repaint) stdout.write(`\x1b[${lineCount}A`)
        stdout.write(
            `\x1b[2K${cyan('?')} ${bold(label)} ${dim('(↑/↓ + Enter)')}\n`,
        )
        choices.forEach((choice, i) => {
            const active = i === index
            const marker = active ? cyan('❯') : ' '
            const name = active ? cyan(choice.label) : choice.label
            const hint = choice.hint ? ` ${dim(`— ${choice.hint}`)}` : ''
            stdout.write(`\x1b[2K${marker} ${name}${hint}\n`)
        })
    }

    readline.emitKeypressEvents(stdin)
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()
    stdout.write('\x1b[?25l')
    render(false)

    return new Promise<T>(resolve => {
        const finish = (value: T): void => {
            stdin.off('keypress', onKeypress)
            stdin.setRawMode(wasRaw)
            stdin.pause()
            stdout.write(`\x1b[${lineCount}A\x1b[J`)
            stdout.write(`${green('✔')} ${bold(label)}: ${cyan(value)}\n`)
            stdout.write('\x1b[?25h')
            resolve(value)
        }

        const onKeypress = (str: string | undefined, key: Key): void => {
            if (key.ctrl && key.name === 'c') {
                stdin.setRawMode(wasRaw)
                abort()
            }
            if (key.ctrl && key.name === 'd') {
                finish(defaultValue)
            } else if (key.name === 'up' || str === 'k') {
                index = (index - 1 + choices.length) % choices.length
                render(true)
            } else if (key.name === 'down' || str === 'j') {
                index = (index + 1) % choices.length
                render(true)
            } else if (key.name === 'return') {
                finish(choices[index].value)
            } else if (
                str !== undefined &&
                /^[1-9]$/.test(str) &&
                Number(str) <= choices.length
            ) {
                index = Number(str) - 1
                render(true)
            }
        }

        stdin.on('keypress', onKeypress)
    })
}

export function createTerminalPrompter(): Prompter {
    return { text: textPrompt, select: selectPrompt }
}

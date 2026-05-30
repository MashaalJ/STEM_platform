import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

let registered = false;

export const ARDUINO_CATEGORY_COLORS = {
  control: '#f59e0b',
  logic: '#8b5cf6',
  math: '#2563eb',
  variables: '#14b8a6',
  arduino: '#003c71',
};

export const SIDEBAR_CATEGORIES: Array<{
  id: string;
  label: string;
  color: string;
  blocks: Array<{ type: string; label: string }>;
}> = [
  {
    id: 'control',
    label: 'Control',
    color: ARDUINO_CATEGORY_COLORS.control,
    blocks: [
      { type: 'controls_repeat_ext', label: 'Repeat' },
      { type: 'controls_whileUntil', label: 'While / Until' },
      { type: 'controls_for', label: 'For Loop' },
      { type: 'arduino_delay_ms', label: 'Delay (ms)' },
    ],
  },
  {
    id: 'logic',
    label: 'Logic',
    color: ARDUINO_CATEGORY_COLORS.logic,
    blocks: [
      { type: 'controls_if', label: 'If / Else' },
      { type: 'logic_compare', label: 'Compare' },
      { type: 'logic_operation', label: 'And / Or' },
      { type: 'logic_boolean', label: 'True / False' },
    ],
  },
  {
    id: 'math',
    label: 'Math',
    color: ARDUINO_CATEGORY_COLORS.math,
    blocks: [
      { type: 'math_number', label: 'Number' },
      { type: 'math_arithmetic', label: 'Arithmetic' },
      { type: 'math_modulo', label: 'Modulo' },
      { type: 'math_random_int', label: 'Random Int' },
    ],
  },
  {
    id: 'variables',
    label: 'Variables',
    color: ARDUINO_CATEGORY_COLORS.variables,
    blocks: [
      { type: 'variables_set', label: 'Set Variable' },
      { type: 'variables_get', label: 'Get Variable' },
      { type: 'math_change', label: 'Change Variable' },
    ],
  },
  {
    id: 'arduino',
    label: 'Arduino',
    color: ARDUINO_CATEGORY_COLORS.arduino,
    blocks: [
      { type: 'arduino_digital_write', label: 'Digital Write' },
      { type: 'arduino_digital_read', label: 'Digital Read' },
      { type: 'arduino_analog_read', label: 'Analog Read' },
      { type: 'arduino_servo_write', label: 'Servo Write' },
      { type: 'arduino_delay_ms', label: 'Delay' },
    ],
  },
];

export const TOOLBOX_CONFIG = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Control',
      categorystyle: 'control_category',
      colour: ARDUINO_CATEGORY_COLORS.control,
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
        { kind: 'block', type: 'controls_flow_statements' },
        { kind: 'block', type: 'arduino_delay_ms' },
      ],
    },
    {
      kind: 'category',
      name: 'Logic',
      categorystyle: 'logic_category',
      colour: ARDUINO_CATEGORY_COLORS.logic,
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      categorystyle: 'math_category',
      colour: ARDUINO_CATEGORY_COLORS.math,
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int' },
      ],
    },
    {
      kind: 'category',
      name: 'Variables',
      categorystyle: 'variable_category',
      custom: 'VARIABLE',
      colour: ARDUINO_CATEGORY_COLORS.variables,
    },
    {
      kind: 'category',
      name: 'Arduino',
      colour: ARDUINO_CATEGORY_COLORS.arduino,
      contents: [
        { kind: 'block', type: 'arduino_digital_write' },
        { kind: 'block', type: 'arduino_digital_read' },
        { kind: 'block', type: 'arduino_analog_read' },
        { kind: 'block', type: 'arduino_servo_write' },
        { kind: 'block', type: 'arduino_delay_ms' },
      ],
    },
  ],
};

export function registerArduinoBlocklyDefinitions() {
  if (registered) return;

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'arduino_program_start',
      message0: 'when program starts %1',
      args0: [{ type: 'input_statement', name: 'DO' }],
      colour: 35,
      tooltip: 'Entry point for setup + loop logic',
      helpUrl: '',
    },
    {
      type: 'arduino_digital_write',
      message0: 'digital write pin %1 state %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: Array.from({ length: 14 }, (_, i) => [String(i), String(i)]),
        },
        {
          type: 'field_dropdown',
          name: 'STATE',
          options: [
            ['HIGH', 'HIGH'],
            ['LOW', 'LOW'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: 'Set digital pin HIGH or LOW',
      helpUrl: '',
    },
    {
      type: 'arduino_digital_read',
      message0: 'digital read pin %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: Array.from({ length: 14 }, (_, i) => [String(i), String(i)]),
        },
      ],
      output: 'Number',
      colour: 210,
      tooltip: 'Read current digital value from a pin',
      helpUrl: '',
    },
    {
      type: 'arduino_analog_read',
      message0: 'analog read pin %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((x) => [x, x]),
        },
      ],
      output: 'Number',
      colour: 210,
      tooltip: 'Read analog value from A0-A5',
      helpUrl: '',
    },
    {
      type: 'arduino_delay_ms',
      message0: 'delay %1 ms',
      args0: [
        {
          type: 'input_value',
          name: 'MS',
          check: 'Number',
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: 'Pause program for milliseconds',
      helpUrl: '',
    },
    {
      type: 'arduino_servo_write',
      message0: 'servo write pin %1 angle %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'PIN',
          options: Array.from({ length: 14 }, (_, i) => [String(i), String(i)]),
        },
        {
          type: 'input_value',
          name: 'ANGLE',
          check: 'Number',
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: 'Set servo angle (0-180)',
      helpUrl: '',
    },
  ]);

  javascriptGenerator.forBlock.arduino_program_start = (block, generator) => {
    const statements = generator.statementToCode(block, 'DO');
    return `${statements}`;
  };

  javascriptGenerator.forBlock.arduino_digital_write = (block) => {
    const pin = block.getFieldValue('PIN');
    const state = block.getFieldValue('STATE');
    return `__arduinoDigitalWrite(${pin}, ${state});\n`;
  };

  javascriptGenerator.forBlock.arduino_digital_read = (block) => {
    const pin = block.getFieldValue('PIN');
    return [`__arduinoDigitalRead(${pin})`, Order.FUNCTION_CALL];
  };

  javascriptGenerator.forBlock.arduino_analog_read = (block) => {
    const pin = block.getFieldValue('PIN');
    return [`__arduinoAnalogRead(${JSON.stringify(pin)})`, Order.FUNCTION_CALL];
  };

  javascriptGenerator.forBlock.arduino_delay_ms = (block, generator) => {
    const ms = generator.valueToCode(block, 'MS', Order.NONE) || '1000';
    return `delay(${ms});\n`;
  };

  javascriptGenerator.forBlock.arduino_servo_write = (block, generator) => {
    const pin = block.getFieldValue('PIN');
    const angle = generator.valueToCode(block, 'ANGLE', Order.NONE) || '90';
    return `__arduinoServoWrite(${pin}, ${angle});\n`;
  };

  registered = true;
}

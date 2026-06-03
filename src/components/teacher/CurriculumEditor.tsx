/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ClassCurriculumEditor from '../curriculum/CurriculumEditor';

export default function TeacherCurriculumEditor({
  classId,
  className,
  wrapped = false,
  subtitle,
}: {
  classId: string | null;
  className?: string;
  wrapped?: boolean;
  subtitle?: string;
}) {
  const title = className ? `${className} — curriculum` : 'Class curriculum';
  const editorSubtitle =
    subtitle ??
    (wrapped
      ? 'Toggle missions, drag to reorder, and optionally override titles or unlock order for the selected class.'
      : 'Control which missions students in this class see and in what order.');

  const editor = (
    <ClassCurriculumEditor
      classId={classId}
      mode="class"
      title={wrapped ? 'Class curriculum' : title}
      subtitle={editorSubtitle}
    />
  );

  if (wrapped) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        {editor}
      </div>
    );
  }

  return editor;
}

function show(notes: Note[]): void {
  out.write(`${notes.length} notes\n`);           // entry
  for (const note of notes) {                     // nextNote: another note?
    const lines = format(note).split("\n");       // format
    for (const line of lines) {                   // nextLine: another line?
      out.write(`  ${line}\n`);                   // print
    }
  }
  out.end();                                      // exit
}

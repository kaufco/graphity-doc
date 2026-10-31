function load(file: string): Note[] {
  const lines = read(file);                  // entry
  const notes: Note[] = [];
  for (let i = 0; i < lines.length; i++) {   // header: i < lines.length
    const line = lines[i];                   // body
    if (line.trim() !== "") {
      notes.push(parse(line));               // then
    }
  }                                          // next: i++
  return notes;                              // exit
}

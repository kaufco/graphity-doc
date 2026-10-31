function load(file: string): Note[] {
  const lines = read(file);                  // entry
  const notes: Note[] = [];
  let last: Note | null = null;
  for (let i = 0; i < lines.length; i++) {   // header: i < lines.length
    const line = lines[i];                   // body
    if (line.trim() !== "") {
      last = parse(line);                    // then
      notes.push(last);
    }
  }                                          // next: i++
  lastLoaded = last;                         // exit
  return notes;
}

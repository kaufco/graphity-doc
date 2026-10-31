fn load(&mut self, file: &Path) -> Vec<Note> {
    let lines = read(file);                    // entry
    let mut notes = Vec::new();
    let mut last = None;
    let mut i = 0;
    while i < lines.len() {                    // header: i < lines.len()
        let line = &lines[i];                  // body
        if !line.trim().is_empty() {
            let note = parse(line);            // then
            last = Some(note.clone());
            notes.push(note);
        }
        i += 1;                                // next
    }
    self.last_loaded = last;                   // exit
    notes
}

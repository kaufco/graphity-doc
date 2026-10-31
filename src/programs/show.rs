fn show(notes: &[Note]) {
    println!("{} notes", notes.len());                   // entry
    for note in notes {                                  // nextNote: another note?
        let text = format(note);                         // format
        for line in text.lines() {                       // nextLine: another line?
            println!("  {line}");                        // print
        }
    }
    let _ = io::stdout().flush();                        // exit
}

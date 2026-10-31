void Show(List<Note> notes)
{
    output.WriteLine($"{notes.Count} notes");                 // entry
    foreach (Note note in notes)                              // nextNote: another note?
    {
        string[] lines = Format(note).Split('\n');            // format
        foreach (string line in lines)                        // nextLine: another line?
        {
            output.WriteLine("  " + line);                    // print
        }
    }
    output.Flush();                                           // exit
}

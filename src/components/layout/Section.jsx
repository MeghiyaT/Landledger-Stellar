
const Section = ({ children, className = '', padding = 'md' }) => {
  const paddingClasses = {
    sm: 'py-8',
    md: 'py-16',
    lg: 'py-24',
  }

  return (
    <section className={`${paddingClasses[padding]} ${className}`}>
      {children}
    </section>
  )
}

export default Section

